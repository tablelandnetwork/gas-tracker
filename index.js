import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import Web3 from 'web3';
import evm from "@tableland/evm";
import sqlite3 from "sqlite3";
import EthDater from 'ethereum-block-by-date';
import * as dotenv from "dotenv";
import { helpers } from '@tableland/sdk';
import moment from 'moment';

// Load environment variables from .env file
const config = dotenv.config().parsed;

// Create database object
const db = new sqlite3.Database('cost_of_writes.db');

// Gets Tableland events from the chain
async function fetchHandler(argv) {
  // Create a new Web3 instance for connecting to the chain
  const web3 = new Web3(new Web3.providers.HttpProvider(argv.providerUrl));

  // Tools to convert datetimes to their corresponding block number
  const dater = new EthDater(web3);

  // Get chain information using the web3 instance and the SDK's helper method
  const chain = helpers.getChainInfo(await web3.eth.getChainId());

  // Get the ABI for the TablelandTables contract
  const abi = evm.TablelandTables__factory.abi;

  // Create an instance of the contract
  const contract = new web3.eth.Contract(abi, chain.contractAddress, { address: chain.contractAddress });

  // Get the transactions from the chain
  async function getTransactions() {
    // Initialize start block number
    let startBlock = 0;

    // If the "from" flag is set to "latest", get higher block number already in database
    if (argv.from === "latest") {
      const highestBlockNumber = await new Promise((resolve, reject) => {
        db.prepare(`
          SELECT MAX(block) as highestBlock
            FROM CostOfWrites
            WHERE network = ?;
        `).bind(chain.chainName).all((err, result) => {
          resolve(result[0].highestBlock);
        });
      });

      // Set the start block to the highest block + 1
      startBlock = highestBlockNumber + 1;
    } else {
      // If the "from" flag is set to a date, convert the date to a block number
      const dateFormat = "MM-DD-YYYY";
      const date = moment(argv.from, dateFormat).toDate();
      startBlock = await dater.getDate(date);
    }

    // TODO: Detect data from "to" flag
    // Set the end block to the current block
    let endBlock = await dater.getDate(new Date());

    // Get past CreateTable events from the chain
    const createEvents = await contract.getPastEvents('CreateTable', {
      fromBlock: startBlock.block,
      toBlock: endBlock.block
    });

    // Get past RunSQL events from the chain
    const runEvents = await contract.getPastEvents('RunSQL', {
      fromBlock: startBlock.block,
      toBlock: endBlock.block
    });

    // Put all the events in one array
    const events = [...runEvents, ...createEvents];

    // Initialize an array to store processed events
    const processedEvents = [];

    // Loop through the events and grab more data about the transaction
    for (const event of events) {
      // Get transaction details
      const receipt = await web3.eth.getTransactionReceipt(event.transactionHash);
      // Push transaction details to processed events
      processedEvents.push([event.transactionHash, chain.chainName, event.event, event.blockNumber, receipt.effectiveGasPrice, receipt.gasUsed]);
    }

    return processedEvents;
  }


  // Create the CostOfWrites table 
  db.serialize(async () => {
    db.run(`CREATE TABLE IF NOT EXISTS CostOfWrites (
      transactionId text primary key not null,
      network text,
      statementType text,
      block int,
      gasPrice int,
      gasUsed int
    )`);

    // Upsert data (though she be unneccessary)
    const insertIntoCostOfWrites = db.prepare(`
        INSERT INTO CostOfWrites (
          transactionId,
          network,
          statementType,
          block,
          gasPrice,
          gasUsed
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (transactionId) DO UPDATE SET
          network = excluded.network,
          statementType = excluded.statementType,
          block = excluded.block,
          gasPrice = excluded.gasPrice,
          gasUsed = excluded.gasUsed;
    `);

    // Process array of transactions from the chain
    const transactions = await getTransactions();

    // Send 'em
    transactions.forEach(transaction => {
      insertIntoCostOfWrites.run(...transaction);
    });

    insertIntoCostOfWrites.finalize();
  });
}

// Logs the average cost of a method specified by `method` argument (CreateTable or RunSQL)
async function readHandler(argv) {
  const { chain, method } = argv;

  // TODO: Pass in dates to retreive from
  let startBlock = 0;
  let endBlock = 1000000000;

  // Find the average cost of a transaction to the method specified
  db.all(`
    SELECT AVG(gasUsed * gasPrice) as averageCost
    FROM CostOfWrites
    WHERE block BETWEEN ? AND ?
    AND statementType = ?
  `, [startBlock, endBlock, method], (error, rows) => {
    if (error) {
      console.error(error);
      return;
    }

    console.log({
      chain,
      method,
      startBlock,
      endBlock,
      averageCostInWei: rows[0].averageCost
    })
  });

  // Close the database connection
  db.close();
}

const commands = [
  { 
    command: "read",
    description: "Retrieve and log the average cost of the specified method",
    handler: readHandler,
    builder: (yargs) => {
      yargs.option("method", {
        type: "string",
        description: "CreateTable or RunSQL, defaults to CreateTable",
        default: "CreateTable"
      })
    }
  },
  { 
    command: "fetch",
    description: "Retrieve data from the chain and store it in the database",
    handler: fetchHandler
  }
]

const _argv = yargs(hideBin(process.argv))
  // Configure the yargs parser to remove dashes and apply camel case expansion.
  .parserConfiguration({
    "strip-aliased": true,
    "strip-dashed": true,
    "camel-case-expansion": true,
  })
  .command(commands)
  .config(config)
  .option("from", {
    type: "string",
    description: "Earliest date from which to fetch data",
    default: "latest"
  })
  .option("to", {
    type: "string",
    description: "Latest date from which to fetch data",
    default: "now"
  })
  .option("method", {
    type: "string",
    description: "Which method to shows the costs of. Defaults to CreateTable",
    default: "CreateTable"
  })
  .options("providerUrl", {
    alias: "p",
    type: "string",
    description:
      "JSON RPC API provider URL. (e.g., https://eth-rinkeby.alchemyapi.io/v2/123abc123a...)",
  })
  // Require at least one command to be passed to the CLI.
  .demandCommand(1, "")
  .strict().argv;
