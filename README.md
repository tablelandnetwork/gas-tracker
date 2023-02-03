# Cost of Writes Script

This script collects information about Tableland events (CreateTable and RunSQL) from a blockchain and stores the information in an SQLite database. The script also provides options for updating the database with information from a specific date or from the latest block in the database.

## Prerequisites

-   Node.js and NPM must be installed on your machine
-   A blockchain provider URL must be provided when running the script

## Installation

1.  Clone the repository
2.  Navigate to the repository in your terminal
3.  Run `npm install` to install the dependencies

## Configuration

1.  Create a `.env` file in the root of the repository
2.  Add the following environment variables to the `.env` file:

`PROVIDER_URL=<YOUR_BLOCKCHAIN_PROVIDER_URL>` 
Example: `https://mainnet.infura.io/v3/<your-project-id>`

## Running the Script

The script can be run using the following command:

`node index.js fetch --from <FROM_DATE> [--to <TO_DATE>]` 

The `--from` and `--to` flags accepts a date in the format `MM-DD-YYYY`.

BE FOREWARNED: This script _may_ make a lot of requests to your provider. 

` node index.js read --method RunSQL`

## Dependencies

This script uses the following dependencies:
 
-   yargs: a library for building command-line tools
-   Web3: a library for interacting with Ethereum networks
-   @tableland/evm: a library for generating ABIs for Tableland contracts
-   sqlite3: a library for working with SQLite databases
-   EthDater: a library for converting dates to block numbers
-   dotenv: a library for loading environment variables from a `.env` file
-   moment: a library for working with dates and times

## Database

The script stores data in an SQLite database located at `cost_of_writes.db`. The database contains a single table, `CostOfWrites`, which contains the following columns:

-   transactionId: the transaction hash for the Tableland event
-   network: the name of the network the transaction was sent to
-   statementType: the type of event (CreateTable or RunSQL)
-   block: the block number in which the event was included
-   gasPrice: the gas price used for the transaction
-   gasUsed: the amount of gas used for the transaction

## Contributing

If you'd like to contribute to this project, please fork the repository and create a pull request. We welcome contributions of all kinds!
