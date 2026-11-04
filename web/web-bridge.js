// Minimal browser-extension API bridge. Credentials stay exclusively in Worker secrets.
globalThis.chrome = {
  storage:{local:{
    get(keys,callback){
      const result=Array.isArray(keys)?{}:{...keys};
      for(const key of Array.isArray(keys)?keys:Object.keys(keys)){
        const stored=localStorage.getItem(key);
        if(stored!==null){try{result[key]=JSON.parse(stored)}catch{result[key]=stored}}
      }
      if(!result.localePreference)result.localePreference='zh-CN';
      callback?.(result); return Promise.resolve(result);
    },
    set(values,callback){for(const [key,value] of Object.entries(values))localStorage.setItem(key,JSON.stringify(value));callback?.();return Promise.resolve();}
  }},
  runtime:{
    lastError:null,
    sendMessage(message,callback){
      const refresh=message.action==='refreshQuotas';
      const url=message.action==='getAccountOverview'?'/api/overview':'/api/quotas';
      fetch(refresh?'/api/refresh':url,{method:refresh?'POST':'GET'}).then(async response=>{
        const data=await response.json();if(!response.ok)throw new Error(data.error||'读取失败');
        chrome.runtime.lastError=null;callback(data);
      }).catch(error=>{chrome.runtime.lastError={message:error.message};callback({error:error.message});});
    }
  }
};
if(!new URLSearchParams(location.search).has('profile')){history.replaceState({},'',location.pathname+'?profile=asklight');}
