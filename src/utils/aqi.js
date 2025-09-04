// CPCB breakpoints (instantaneous use; official uses averaging windows)
const BP = {
  pm2_5: [[0,30,0,50],[31,60,51,100],[61,90,101,200],[91,120,201,300],[121,250,301,400],[251,10000,401,500]],
  pm10:  [[0,50,0,50],[51,100,51,100],[101,250,101,200],[251,350,201,300],[351,430,301,400],[431,10000,401,500]],
  no2:   [[0,40,0,50],[41,80,51,100],[81,180,101,200],[181,280,201,300],[281,400,301,400],[401,10000,401,500]],
  so2:   [[0,40,0,50],[41,80,51,100],[81,380,101,200],[381,800,201,300],[801,1600,301,400],[1601,100000,401,500]],
  o3:    [[0,50,0,50],[51,100,51,100],[101,168,101,200],[169,208,201,300],[209,748,301,400],[749,100000,401,500]],
  co:    [[0,1.0,0,50],[1.1,2.0,51,100],[2.1,10,101,200],[10.1,17,201,300],[17.1,34,301,400],[34.1,1000,401,500]],
  nh3:   [[0,200,0,50],[201,400,51,100],[401,800,101,200],[801,1200,201,300],[1201,1800,301,400],[1801,100000,401,500]]
};

function subIndex(C, table){
  for(const [Blo,Bhi,Ilo,Ihi] of table){
    if(C>=Blo && C<=Bhi) return Math.round(((Ihi-Ilo)/(Bhi-Blo))*(C-Blo)+Ilo);
  }
  return null;
}

// Convert to 1-5 scale as per your rule
function aqiToScale(aqi){
  if(aqi<=50) return 1;           // Good
  if(aqi<=100) return 2;          // Moderate
  if(aqi<=200) return 3;          // Poor
  if(aqi<=300) return 4;          // Very Poor
  return 5;                       // Severe (beyond upper limit of 4)
}

function computeIndiaAQI(components){
  if(!components) return null;
  const vals = {
    pm2_5: +components.pm2_5, pm10: +components.pm10, no2: +components.no2,
    so2: +components.so2, o3: +components.o3, nh3: +components.nh3,
    co: components.co !== undefined ? (+components.co)/1000.0 : undefined // µg/m3 -> mg/m3
  };
  const subs = [];
  for(const k of Object.keys(BP)){
    const v = vals[k];
    if(v!==undefined && !Number.isNaN(v)){
      const s = subIndex(v, BP[k]);
      if(s!==null) subs.push({ pollutant:k, subIndex:s });
    }
  }
  if(subs.length===0) return null;
  const worst = subs.reduce((a,b)=> b.subIndex>a.subIndex?b:a);
  return { aqi: worst.subIndex, main_pollutant: worst.pollutant, all_subindices: subs, scale: aqiToScale(worst.subIndex) };
}

module.exports = { computeIndiaAQI, aqiToScale };