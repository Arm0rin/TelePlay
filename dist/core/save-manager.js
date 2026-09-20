(() => {
  const KEY='teleplay-player-data',VERSION=7;
  const GAME_IDS=['neon-race','neon-hook','penalty-duel','beat-dash','block-grid'];
  const gameForItem=id=>{const registered=(window.TelePlayCatalog?.games||[]).map(game=>game.id).filter(Boolean);return [...new Set([...registered,...GAME_IDS])].sort((a,b)=>b.length-a.length).find(gameId=>String(id||'').startsWith(`${gameId}-`))||null};
  const scope=(input={},fallbackOwned=[])=>({ownedItems:Array.from(new Set([...(Array.isArray(input.ownedItems)?input.ownedItems:[]),...fallbackOwned])),equippedItems:{...(input.equippedItems||{})},purchaseHistory:Array.isArray(input.purchaseHistory)?input.purchaseHistory:[]});
  const normalizeInventory=input=>{
    const source=input||{}, legacyOwned=Array.isArray(source.ownedItems)?source.ownedItems:[], legacyEquipped=source.equippedItems||{}, legacyHistory=Array.isArray(source.purchaseHistory)?source.purchaseHistory:[];
    const profile=scope(source.profile,['avatar-frame-neon']), games={};
    Object.entries(source.games||{}).forEach(([gameId,value])=>{games[gameId]=scope(value)});
    legacyOwned.forEach(id=>{const gameId=gameForItem(id);if(gameId){games[gameId]??=scope();games[gameId].ownedItems.push(id)}else profile.ownedItems.push(id)});
    Object.entries(legacyEquipped).forEach(([slot,id])=>{const gameId=gameForItem(id);if(gameId){games[gameId]??=scope();games[gameId].equippedItems[slot]=id}else profile.equippedItems[slot]=id});
    legacyHistory.forEach(entry=>{const gameId=gameForItem(entry?.itemId);if(gameId){games[gameId]??=scope();games[gameId].purchaseHistory.push(entry)}else profile.purchaseHistory.push(entry)});
    profile.ownedItems=Array.from(new Set(['avatar-frame-neon',...profile.ownedItems]));
    Object.values(games).forEach(value=>{value.ownedItems=Array.from(new Set(value.ownedItems))});
    return {profile,games};
  };
  const migrations={
    1:data=>({...data,saveVersion:1}),
    2:data=>{
      const base=defaults(), legacyAchievements=Array.isArray(data.achievements)?data.achievements:[];
      const balance=Math.max(Number(data.coins||0),Number(data.economy?.coins||0));
      return {...base,...data,saveVersion:2,playerVersion:Number(data.playerVersion||1),coins:balance,economy:{...(base.economy||{}),...(data.economy||{}),coins:balance},profile:{...base.profile,...(data.profile||{})},progress:{...base.progress,...(data.progress||{}),level:Math.max(1,Number(data.progress?.level||1)),xp:Math.max(0,Number(data.progress?.xp||0)),totalXP:Math.max(Number(data.progress?.totalXP||0),Number(data.progress?.xp||0))},statistics:{...base.statistics,...(data.statistics||{})},achievements:{...base.achievements,...(data.achievements&&!Array.isArray(data.achievements)?data.achievements:{}),unlockedAchievements: data.achievements&&!Array.isArray(data.achievements)&&Array.isArray(data.achievements.unlockedAchievements)?data.achievements.unlockedAchievements:legacyAchievements},settings:{...base.settings,...(data.settings||{})},activity:{...base.activity,...(data.activity||{})}};
    },
    3:data=>{
      const base=defaults(), progression=data.progression||{};
      return {...base,...data,saveVersion:3,playerVersion:Math.max(2,Number(data.playerVersion||1)),statistics:{...base.statistics,...(data.statistics||{})},activity:{...base.activity,...(data.activity||{}),daily:{...base.activity.daily,...(data.activity?.daily||{})}},mastery:{...base.mastery,...(data.mastery||{})},titles:{...base.titles,...(data.titles||{})},progression:{...base.progression,...progression}};
    },
    4:data=>{
      const base=defaults(), legacyDaily=data.activity?.daily||{}, progression={...base.progression,...(data.progression||{})}, challenges={...(progression.challenges||{})};
      const existingStreak=challenges.streak||{}, legacyStreak={currentStreak:Number(legacyDaily.currentStreak||legacyDaily.streak||0),bestStreak:Number(legacyDaily.bestStreak||legacyDaily.currentStreak||legacyDaily.streak||0),lastActiveDate:legacyDaily.lastActiveDate||null};
      const streak={...legacyStreak,...existingStreak};
      return {...base,...data,saveVersion:4,playerVersion:Math.max(2,Number(data.playerVersion||1)),activity:{...base.activity,...(data.activity||{}),daily:{lastActiveDate:legacyDaily.lastActiveDate||null}},progression:{...progression,challenges:{...challenges,streak}}};
    },
    5:data=>{
      const base=defaults(), inventory=data.inventory||{}, balance=Math.max(0,Number(data.coins||0),Number(data.economy?.coins||0));
      const normalized={...base,...data,saveVersion:5,coins:balance,currencyTransactions:Array.isArray(data.currencyTransactions)?data.currencyTransactions:[]};
      delete normalized.economy;
      return {...normalized,inventory:normalizeInventory(inventory)};
    },
    6:data=>{
      const base=defaults(), legacyGems=Number(data.teleGems ?? data.gems ?? 0), history=Array.isArray(data.currencyTransactions)?data.currencyTransactions.map(item=>({ ...item, currencyType:item.currencyType||'coins' })) : [];
      const normalized={...base,...data,saveVersion:6,gems:Math.max(0,legacyGems),currencyTransactions:history};
      delete normalized.teleGems;
      return normalized;
    },
    7:data=>({ ...data, saveVersion:7, adminActionLog:Array.isArray(data.adminActionLog)?data.adminActionLog:[], analyticsEvents:Array.isArray(data.analyticsEvents)?data.analyticsEvents:[] })
  };
  const clone=value=>JSON.parse(JSON.stringify(value));
  const defaults=()=>({saveVersion:VERSION,playerVersion:2,profile:{},coins:0,gems:0,currencyTransactions:[],adminActionLog:[],analyticsEvents:[],inventory:{profile:{ownedItems:['avatar-frame-neon'],equippedItems:{avatarFrame:'avatar-frame-neon'},purchaseHistory:[]},games:{}},statistics:{gamesPlayed:0,totalGames:0,totalScore:0,totalCoinsEarned:0,totalPlayTime:0,recordsCount:0,totalGoals:0,perfectActions:0,launchesByGame:{},bestResults:{}},records:{},progress:{level:1,xp:0,totalXP:0},mastery:{},titles:{unlockedTitleIds:['rookie'],activeTitleId:'rookie'},progression:{},achievements:{unlockedAchievements:[]},settings:{soundEnabled:true,musicEnabled:true,hapticEnabled:true,language:'ru',performanceMode:'auto'},activity:{lastPlayedGameId:null,lastPlayedDate:null,lastProgress:0,daily:{lastActiveDate:null}},favoriteGameId:null});
  const readRaw=()=>{try{const raw=localStorage.getItem(KEY),current=JSON.parse(raw||'null')||defaults(),legacy=JSON.parse(localStorage.getItem('teleplay-game-stats')||'{}'),hasCanonicalBalance=Object.prototype.hasOwnProperty.call(current,'coins');if(!raw||!hasCanonicalBalance){const legacyCoins=Math.max(0,Number(current.economy?.coins||0),Number(localStorage.getItem('turbo-coins')||0));current.coins=legacyCoins}return {...current,records:{...legacy,...(current.records||{})}}}catch(_){return defaults()}};
  function migrate(input){let data={...defaults(),...input},version=Number(data.saveVersion||0);if(version<1)version=1;for(let v=version;v<=VERSION;v++)data=migrations[v]?migrations[v](data):data;data.saveVersion=VERSION;return data}
  const SaveManager={version:VERSION,read:()=>{const raw=readRaw(),next=migrate(raw);if(JSON.stringify(raw)!==JSON.stringify(next)){localStorage.setItem(KEY,JSON.stringify(next));localStorage.removeItem('turbo-coins')}return next},write:data=>{const next=migrate(data);localStorage.setItem(KEY,JSON.stringify(next));localStorage.removeItem('turbo-coins');return clone(next)},update:patch=>SaveManager.write({...SaveManager.read(),...patch}),reset:()=>SaveManager.write(defaults())};
  window.TelePlayCore??={};window.TelePlayCore.SaveManager=SaveManager;
})();
