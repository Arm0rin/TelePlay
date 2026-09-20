(() => {
  const RewardManager={
    applyProof(proof){
      if(!proof||proof.status!=='issued'||!proof.id)return {ok:false,reason:'invalid_reward_proof'};
      try{window.dispatchEvent(new CustomEvent('teleplay:reward-proof',{detail:proof}))}catch(_){ }
      return {ok:true,proofId:proof.id,reward:proof.rewardData||proof.reward||{}};
    },
    isApplyingProof(){return false},
    award(gameId,{coins=0,gems=0,bonus=0,xp=0,xpSource='reward',score=0,stats={},metadata={},transactionId,rewardId,rewardProof}={}){
      if(window.TelePlayCore.DataProvider?.isBackendEnabled?.()){
        if(rewardProof)return this.applyProof(rewardProof);
        return {ok:false,reason:'reward_proof_required',pending:true,coins:0,gems:0,xp:0,score};
      }
      const details=metadata||{},coinAmount=Math.max(0,Math.floor(Number(coins||0)+Number(bonus||0))),gemAmount=Math.max(0,Math.floor(Number(gems||0))),xpAwarded=Math.max(0,Math.floor(Number(xp||0))),id=transactionId||rewardId||details.transactionId,tx={...details,...(id?{transactionId:id}:{}),gameId,score};
      const coinCurrency=coinAmount ? (window.TelePlayCore.CurrencyManager?.addCoins?.(coinAmount,gameId||'reward',tx)||{ok:true,added:0,balance:window.TelePlayCore.PlayerData.coins()}) : {ok:true,added:0,balance:window.TelePlayCore.PlayerData.coins()};
      const gemCurrency=gemAmount ? (window.TelePlayCore.CurrencyManager?.addGems?.(gemAmount,gameId||'reward',{...tx,transactionId:id?`${id}:gems`:undefined}) || {ok:false,added:0,balance:window.TelePlayCore.PlayerData.gems?.()||0,reason:'currency_manager_unavailable'}) : {ok:true,added:0,balance:window.TelePlayCore.PlayerData.gems?.()||0};
      const duplicate=Boolean(coinCurrency.duplicate || gemCurrency.duplicate);
      if(!duplicate&&xpAwarded)window.TelePlayCore.PlayerData.addXP(xpAwarded,xpSource,{gameId});
      if(!duplicate&&Object.keys(stats).length)window.TelePlayCore.PlayerData.record(gameId,stats);
      return {ok:coinCurrency.ok !== false && gemCurrency.ok !== false,coins:coinAmount,gems:gemAmount,balance:coinCurrency.balance,gemsBalance:gemCurrency.balance,xp:duplicate?0:xpAwarded,score,transaction:coinCurrency.transaction||gemCurrency.transaction,duplicate};
    },
    spend(gameId,{coins=0,gems=0,currency,amount,metadata={},transactionId,purchaseId}={}){
      const details=metadata||{},id=transactionId||purchaseId||details.transactionId,requestedCurrency=String(currency||'coins').toLowerCase()==='gems'?'gems':'coins',cost=amount == null ? (requestedCurrency==='gems'?gems:coins) : amount,tx={...details,...(id?{transactionId:id}: {})};
      const result=requestedCurrency==='gems' ? window.TelePlayCore.CurrencyManager?.spendGems?.(cost,gameId||'shop',tx) : window.TelePlayCore.CurrencyManager?.spendCoins?.(cost,gameId||'shop',tx);
      const fallback={ok:false,spent:0,balance:requestedCurrency==='gems'?window.TelePlayCore.PlayerData.gems():window.TelePlayCore.PlayerData.coins(),reason:'currency_manager_unavailable'};
      return {...(result||fallback),currency:requestedCurrency,coins:requestedCurrency==='coins'?(result?.spent||0):0,gems:requestedCurrency==='gems'?(result?.spent||0):0};
    }
  };
  window.TelePlayCore??={};window.TelePlayCore.RewardManager=RewardManager;
})();
