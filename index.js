const {env} = process
const moment = require('moment')
const {Stake} = require('casinos')
const config = require('./config')

const {token, strategies} = config
const strategySelected = env.STRATEGY || 50
const goalToVault = env.goalToVault || 0.00005
const coin = env.COIN || 'doge'


const minimumWithdraw = {
  bch:  0.05,
  btc:  0.002,
  doge: 5000,
  eos:  4,
  eth:  0.06,
  ltc:  0.25,
  trx:  750,
  xrp:  50,
}


const stake = new Stake(token)


const calcBaseAmount = (balance, increment, endurance) => balance * (1-increment)/(1-increment**endurance)
const now = () => moment().format('h:mm:ss')


const main = async () => {
  const startBetting = Date.now()
  const strategy = strategies[strategySelected]
  const {condition, endurance, increment, target} = strategy
  const printAfterNLoose = config.printAfterNLoose || 0
  let balance = await stake.getBalance(coin)
  let baseAmount = calcBaseAmount(balance, increment, endurance)
  let totalProfit = 0
  
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
        totalProfit += profit
        toVault += profit * 0.1

        if(toVault > balance * goalToVault) {
          balance = await stake.getBalance(coin)
          
          if(balance > minimumWithdraw[coin]) {
            stake.depositToVault({coin, amount: toVault})
            balance = await stake.getBalance(coin)
          }
          
          toVault = 0
          baseAmount = calcBaseAmount(balance, increment, endurance)
        }


        if(printAfterNLoose >= looseInRow) {
          const deltaTimeOnHours = (Date.now() - startBetting)/60000/60
          console.log('win', now(), coin, profit.toFixed(8), 'maxLoose', maxLoose, 'looseInRow', looseInRow, 'win/hour', (totalProfit/deltaTimeOnHours).toFixed(8))
        }
        looseInRow = 0

      } else {
        looseInRow++
        if(looseInRow > maxLoose) {
          maxLoose = looseInRow
          console.log(now(), 'maxLoose:', maxLoose)
        }
      }
    } catch (error){
      const waitedTime = 60*1000 
      const err = await new Promise(r => setTimeout(()=> r(`Error ${error}, waited ${waitedTime}ms`), waitedTime)) //wait 1min for next try
      console.log(err)
    }
  }
}

main()
