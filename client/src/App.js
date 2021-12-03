import React, { Component, useState } from "react";
import raffleLotteryContract from "./contracts/raffleLottery.json";
import Web3 from 'web3';
import { Button } from "@material-ui/core";

import { inspect } from 'util' // or directly
// or 
// var util = require('util')

import "./App.css";

class App extends Component {
  state = {
    lotteryStatus: '-', 
    owner: '-',
    runningJackpot: 0, 
    entryTotal: 0, 
    ticketPrice: 0,
    numEntries: 0,
    web3: null, 
    account: null, 
    contract: null,
    eventPlayerEntered: null,
    nonceValue: 0,
    winner: null
  };

  componentDidMount = async () => {
    try {
      

      // const web3 = await getWeb3();
      // bypass getWeb3.js to try use connect button 
      // Exploring web3 without getWeb3.js for better control/understanding    

      const web3 = new Web3(window.ethereum);

      // // Use web3 to get the user's accounts.
      // const accounts = await web3.eth.getAccounts();
      // Use 'Connect MetaMask' Button to connect account
      
      // Get the contract instance.
      const networkId = await web3.eth.net.getId();

      // Lottery contract
      const deployedNetwork = raffleLotteryContract.networks[networkId];
      const instance = new web3.eth.Contract(
        raffleLotteryContract.abi,
        deployedNetwork && deployedNetwork.address,
      );

      // Set web3, and contract to the state, and then proceed with
      // interacting with the contract's methods.
      this.setState({ web3, contract: instance, eventPlayerEntered: null }, this.runGetter);
    } catch (error) {
      // Catch any errors for any of the above operations.
      alert(
        `Failed to load web3, accounts, or contract. Check console for details.`,
      );
      console.error(error);
    }
  };

  // Lottery Contract initial run
  runGetter = async () => {
      const { contract } = this.state;

      const responseLotteryStatus = await contract.methods.isLotteryLive().call();
      const hasLotteryEnded = await contract.methods.hasLotteryEnded().call();

      var lotteryStatusString = ''
     
      // Update state with the result.
      // Three different general states of the interface
      // 1. Interface loaded but contract not connected yet - status: Inactive
      // 2. Contract connected and lottery is in process of gathering user entries - status - Active
      // 3. Owner has declared a winner and lottery is finished - awaiting destruction

      if (!hasLotteryEnded) {
        if (responseLotteryStatus) {
          var ticketPriceResponse = await contract.methods.ticketPrice().call();
          var jackpotTotal = await contract.methods.jackpotTotal().call();
          var entryTotal = await contract.methods.entryCount().call();
          lotteryStatusString = 'ACTIVE'
          var ownerOfLottery = await contract.methods.owner().call();

          this.setState({ runningJackpot: jackpotTotal})
          this.setState({ entryTotal: entryTotal})
          this.setState({ ticketPrice: ticketPriceResponse });
          this.setState({ owner: ownerOfLottery });
        } else lotteryStatusString = 'INACTIVE';
      } else {
        lotteryStatusString = 'FINISHED - Self Destruct Imminent'
        var ticketPriceResponse = await contract.methods.ticketPrice().call();
        var jackpotTotal = await contract.methods.jackpotTotal().call();
        var entryTotal = await contract.methods.entryCount().call();
        var ownerOfLottery = await contract.methods.owner().call();

        var winnerAddress = await contract.methods.winnerAddress().call();
        var winnerEntryNumber = await contract.methods.winnerEntryNumber().call();
        var winnerPrize = await contract.methods.winnerPrize().call();

        this.setState({ 
          winner: 
            { returnValues: 
              {
                entryNumber: winnerEntryNumber, 
                playerAddress: winnerAddress, 
                jackpotTotal: winnerPrize
              }
            }
        })
        this.setState({ runningJackpot: jackpotTotal})
        this.setState({ entryTotal: entryTotal})
        this.setState({ ticketPrice: ticketPriceResponse });
        this.setState({ owner: ownerOfLottery });
      }
      

      this.setState({ lotteryStatus: lotteryStatusString });
    
  };

 // TRYING TO GET THE METAMASK CONNECT BUTTON TO WORK!.....
 // I cannot seem to find out how to disconnect from metamask with a button
 // The Deselect button just deselects it from the interface page, not metamask itself
 // Or connect to a different metamask account if 1 is already connected
 // If no account is connected it opens a metamask window and will use the current account
 // to transact unless changed
 // Everytime an account is changed (in metamask extension) then connect button 
 // must be pressed again to select it on the interface
  connect(event) {
    try {
      // useEthers().activateBrowserWallet; // was trying different methods to improve functionality
      // const web3 = await getWeb3();
      // if (window.ethereum) {
      // Use web3 to get the user's accounts.
      // const accounts = await web3.window;
      // await window.ethereum.enable();
      window.ethereum.enable().then(() => {
        this.state.web3.eth.getAccounts((errors, accounts) => {
          this.state.web3.currentProvider.selectedAddress = accounts[0]
          return this.setState({ account: accounts[0] });
        })
      });
      
    } catch (ex) {
      // this.setState({ numEntries: this.state.numEntries += 1 })  // for debugging
      console.log(ex)
    }    
  }

  disconnect(event) {
    try {
      // window.ethereum.on('disconnect')
      this.state.web3.currentProvider.selectedAddress = null
      this.setState({ account: null })
      
    } catch (ex) {
      // this.setState({ numEntries: this.state.numEntries += 1 }) // for debugging
      console.log(ex)
    }    
  }

  handleIncrementEntryNumber(event){
    this.setState({ numEntries: this.state.numEntries += 1 })
  }
  
  handleDecrementEntryNumber(event){
    if (!this.state.numEntries == 0) {
      this.setState({ numEntries: this.state.numEntries -= 1 })
    }
  }

  // Submits the user transactions to metamask for signing
  // listens to events emited for when the tx is processed
  // And displayed on interface the details of entry
  handleSubmit(event){
    if (this.state.account && this.state.numEntries > 0) {
      const contract = this.state.contract
      const account = this.state.account

      contract.events.playerEntered()
      .on('data', event => this.setState({ eventPlayerEntered: event }))

      contract.methods.enterLottery(this.state.numEntries).send({
        from: account, 
        value: this.state.numEntries*this.state.ticketPrice,
        // gas: 10000000000,
        // gasPrice: '30000000000000'
      }).then((result) => {
        return contract.methods.jackpotTotal().call();
      }).then((result) => {
        this.setState({ runningJackpot: result})
        return contract.methods.entryCount().call();
      }).then((result) => {
        this.setState({ entryTotal: result})
      })
    }
  }

  // Declare winner/listen for events emitted to update interface with winner details
  handleDeclareWinner(event){
    if (this.state.account) {
      const contract = this.state.contract
      const account = this.state.account
  
      contract.events.winnerDeclared()
      .on('data', event => this.setState({ winner: event }))

      contract.events.lotteryActive()
      .on('data', event => {
        if (!event.returnValues.isLotteryLive) var lotteryStatusString = 'FINISHED'
        else var lotteryStatusString = 'What happened?'
        this.setState({ lotteryStatus: lotteryStatusString})
      })

      contract.methods.declareWinner(this.state.nonceValue).send({
        from: account
        // gas: 10000000000,
        // gasPrice: '30000000000000'
      })
    }
  }

  handleSelfDestruct(event){
    const contract = this.state.contract
    const account = this.state.account
    if (account) {
      contract.methods.selfDestruct().send({
        from: account
        // gas: 10000000000,
        // gasPrice: '30000000000000'
      })
    }
  }
  
  handleNonceChange(e) {
    this.setState({ nonceValue: e.target.value})
  }

  // The UI is a bit convoluted and could be organised much better
  // But it works for now...
  render() {
    // var util = require('util') // inspecting web3 object for debug

    if (!this.state.web3) {
      return <div>Loading Web3, accounts, and contract...</div>;
    }
    return (
      <div className="App">
        <Button
          onClick={this.connect.bind(this)}
          variant="contained"
          color="primary"
          style={{
            marginRight: "-1300px",
            width: "250px"
          }}>
            Connect MetaMask
        </Button>
        <Button
          onClick={this.disconnect.bind(this)}
          variant="contained"
          color="secondary"
          style={{
            marginRight: "0px",
            width: "250px"
          }}>
            Deselect Account
        </Button>
        <div>
          <span
            style={{
              marginRight: "-1370px",
              padding: "15px"
            }}>
            * - Connect/Select MetaMask Account - *
          </span>
          <span
            style={{
              marginRight: "0px",
              padding: "15px"
            }}>
            * ---- Deselect MetaMask Account ---- *
          </span>
        </div>
        <div>
          <span
            style={{
              marginRight: "-1360px",
              padding: "10px"
            }}>
            (Only opens window if no account connected yet)
          </span>
          <span
            style={{
              marginRight: "0px",
              padding: "40px"
            }}>
            (Only deselects, disconnect account in ext)
          </span>
        </div>
        <div>
        <h1>Laugh Alottery</h1>
        <h3><i>- because laughter is the language of joy -</i></h3>
        <p>__________________________________________________________________________________________________________________</p>
        <div><b>Status:</b> {this.state.lotteryStatus}</div>
        <div>
          {this.state.winner != null ? <b>WINNER DECLARED!!! - </b> : ''}
          {this.state.winner != null ? <b>Winning Number: </b> : ''}
          {this.state.winner != null ? this.state.winner.returnValues.entryNumber : ''}
          {this.state.winner != null ? <b>---Address: </b> : ''}
          {this.state.winner != null ? this.state.winner.returnValues.playerAddress : ''}
          {this.state.winner != null ? <b>---Prize: </b> : ''}
          {this.state.winner != null ? this.state.winner.returnValues.jackpotTotal/(Math.pow(10, 18)) : ''}
          {this.state.winner != null ? <b> ETH</b> : ''}
        </div>
        <div><b>Current Jackpot:</b> {this.state.runningJackpot/(Math.pow(10, 18))} <b>ETH</b></div>
        <div><b>Total Number of Entries:</b> {this.state.entryTotal - 1}</div>
        <div><b>Ticket Price:</b> {this.state.ticketPrice/(Math.pow(10, 18))} <b>ETH</b></div>
        <div><b>Owner Address</b> {this.state.owner} </div>
        <p>__________________________________________________________________________________________________________________</p>
        </div>
        {/* Only allow to increment or decrement entry number so people cant enter too many?
        It may cause an unfair advantage if a large % of the entries are from a single person...
        Although i guess not rlly, because the odds are proportional to how much you spend...*/}
        <p><h2>Enter Lottery</h2> (Add entries and SUBMIT)</p>
        <button onClick={this.handleIncrementEntryNumber.bind(this)}>More Entries</button>
        <button onClick={this.handleDecrementEntryNumber.bind(this)}>Less Entries</button>
        <div><b>Number of Tickets:</b> {this.state.numEntries}</div>
        <div><b>Price of Tickets:</b> {(this.state.numEntries*this.state.ticketPrice)/(Math.pow(10, 18))} ETH </div>
        <div>_______</div>
        <button onClick={this.handleSubmit.bind(this)}>SUBMIT</button>
        <div>^^^^^^^</div>
        <p>__________________________________________________________________________________________________________________</p>
        <div><b>Selected Account:</b> {this.state.account == this.state.web3.currentProvider.selectedAddress ? this.state.account : '-'}</div>
        __________________________________________________________________________________________________________________
        {/* <div>{util.inspect(this.state.web3)}</div> // for debug*/}
        <div>{this.state.eventPlayerEntered!= null ? <b><i>YOU HAVE ENTERED THE LOTTERY! LAUGH ALOT!!! HAHAha</i></b> : ''}</div>
        <div>
          {this.state.eventPlayerEntered!= null ? <b>Player Address: </b> : ''}
          {this.state.eventPlayerEntered!= null ? this.state.eventPlayerEntered.returnValues.playerAddress : ''}
        </div>
        <div>
          {this.state.eventPlayerEntered!= null ? <b>Number of Entries: </b> : ''}
          {this.state.eventPlayerEntered!= null ? this.state.eventPlayerEntered.returnValues.numEntries : ''}
        </div>
        <div>
          {this.state.eventPlayerEntered!= null ? <b>Ticket Number/s: </b> : ''}
          {this.state.eventPlayerEntered!= null ? this.state.eventPlayerEntered.returnValues.raffleNumbers.toString() : ''}
        </div>
        __________________________________________________________________________________________________________________
        <div>---------- For Owner Use ----------</div>
        Spontaneous Nonce: 
        <input
            style={{width: '50px'}}
            type="number"
            value={this.state.nonceValue}
            onChange={this.handleNonceChange.bind(this)}
        />
         <div></div>
        <button onClick={this.handleDeclareWinner.bind(this)}>END LOTTERY AND DECLARE WINNER</button>

        <div></div>
        <button onClick={this.handleSelfDestruct.bind(this)}>Self Destruct</button>

        {/* <div>{util.inspect(this.state.eventPlayerEntered)}</div> // for debug */}
      </div>
    );
  }
}

export default App;
