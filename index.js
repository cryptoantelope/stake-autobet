const {env} = process
const moment = require('moment')
const {Stake} = require('casinos')
const config = require('./config')

const {token, strategies} = config
const strategySelected = env.STRATEGY || 50
const goalToVault = env.golaToVault || 0.00005
const coin = env.COIN || 'doge'


const stake = new Stake(token)


const calcBaseAmount = (balance, increment, endurance) => balance * (1-increment)/(1-increment**endurance)
const now = () => moment().format('h:mm:ss')


const main = async () => {
  const strategy = strategies[strategySelected]
  const {condition, endurance, increment, target} = strategy
  let balance = await stake.getBalance(coin)
  let baseAmount = calcBaseAmount(balance, increment, endurance)
  
  let looseInRow = 0
  let maxLoose = 0
  let toVault = 0
  
  while(true) {
    const amount = baseAmount * increment ** looseInRow

    try {
      const betResponse = await stake.placeBet({coin, amount, target, condition})
      const {diceRoll} = betResponse
      
      if(diceRoll.payout > 0) {
        const profit = diceRoll.payout - baseAmount*(1-increment**looseInRow)/(1-increment) - baseAmount*increment**looseInRow
        toVault += profit * 0.1

        if(toVault > balance * goalToVault) {
          stake.depositToVault({coin, amount: toVault})
          toVault = 0
          balance = await stake.getBalance(coin)
        }

        console.log('win', now(), coin, profit.toFixed(8), 'maxLoose', maxLoose, 'looseInRow', looseInRow)
        
        looseInRow = 0

      } else {
        looseInRow++
        if(looseInRow > maxLoose) {
          maxLoose = looseInRow
          console.log(now(), 'maxLoose:', maxLoose)
        }
      }
    } catch (error){
      const waitedTime = 2*60*1000 
      const err = await new Promise(r => setTimeout(()=> r(`Error ${error}, waited ${waitedTime}ms`), waitedTime)) //wait 2min for next try
      console.log(err)
    }
  }
}

main()