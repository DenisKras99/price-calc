// Pure model. All money is canonical EUR; currency is a display choice.
// Official reference rates, editable: RUB: Bank of Russia rate in force on 12.10.2026 (set 10.10), CNY: ECB reference of 12.10.2026.
export const fxReference=Object.freeze({RUB:Object.freeze({rate:94.9745,source:'cbr',date:'2026-10-12'}),CNY:Object.freeze({rate:7.4832,source:'ecb',date:'2026-10-12'})});
// Fictional public example; not a supplier quote or company financial data.
export const defaults=Object.freeze({amount:1000,amountBasis:'batch',currency:'EUR',exchangeRates:Object.freeze({EUR:1,RUB:94.9745,CNY:7.4832}),fxDate:'2026-10-12',current:30,free:null,desired:60,conditionMode:'annual',supplierRate:.05,markupRate:.01,ownerRate:.12,bankRate:null,delivery:30,warehouse:30,customer:30,annualPurchases:12000,purchasePeriod:'annual',cycleBefore:30,pricePerKg:1,kgUnitSize:1,batchesPerYear:12,cashTarget:null,volumeKg:null,chinaRate:null,chinaDate:''});
export const createDefaults=()=>({...defaults,exchangeRates:{...defaults.exchangeRates}});
export const freeTerm=x=>x.conditionMode==='free'?x.current:x.free??x.current;
export const convert=(eur,x)=>eur*x.exchangeRates[x.currency];
export const toEUR=(display,x)=>display/x.exchangeRates[x.currency];
export const purchaseAmount=x=>x.volumeKg==null?x.amount:x.pricePerKg*x.volumeKg;
export function validate(x){
 if(x.volumeKg!=null&&(!Number.isFinite(x.volumeKg)||x.volumeKg<0))throw new RangeError('Invalid kg volume');
 for(const k of ['amount','current','desired','supplierRate','markupRate','ownerRate','delivery','warehouse','customer','annualPurchases','cycleBefore','pricePerKg']){if(!Number.isFinite(x[k]))throw new RangeError(`Invalid ${k}`);if(!['current','desired','cycleBefore'].includes(k)&&x[k]<0)throw new RangeError(`Negative ${k}`);}
 if(x.batchesPerYear!==undefined&&!(Number.isInteger(x.batchesPerYear)&&x.batchesPerYear>=1))throw new RangeError('Invalid batches per year');
 if(x.kgUnitSize!==undefined&&![1,100,1000].includes(x.kgUnitSize))throw new RangeError('Invalid kg display unit');
 if(x.free!=null&&!Number.isFinite(x.free))throw new RangeError('Invalid free term');
 for(const k of ['bankRate','chinaRate','cashTarget'])if(x[k]!=null&&(!Number.isFinite(x[k])||x[k]<0))throw new RangeError(`Invalid ${k}`);
 if(x.pricePerKg<=0||!x.exchangeRates||x.exchangeRates.EUR!==1||['EUR','RUB','CNY'].some(k=>!Number.isFinite(x.exchangeRates[k])||x.exchangeRates[k]<=0))throw new RangeError('Invalid kg price or exchange rate');
 if(!['EUR','RUB','CNY'].includes(x.currency)||!['batch','annual'].includes(x.amountBasis)||!['free','annual','markup'].includes(x.conditionMode)||!['annual','monthly'].includes(x.purchasePeriod))throw new RangeError('Invalid selection');
 if(typeof x.chinaDate!=='string'||(x.chinaDate!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(x.chinaDate)||!Number.isFinite(Date.parse(x.chinaDate))||new Date(x.chinaDate).toISOString().slice(0,10)!==x.chinaDate)))throw new RangeError('Invalid reference date');
}
export function alternative(x){return x.bankRate!==null&&x.bankRate<x.ownerRate?{rate:x.bankRate,source:'bank'}:{rate:x.ownerRate,source:'owner'};}
export function atDays(x,days){
 const {rate}=alternative(x),paidDays=Math.max(0,days);
 const supplierCharge=purchaseAmount(x)*(x.conditionMode==='free'||paidDays<=0?0:x.conditionMode==='markup'?x.markupRate:x.supplierRate*paidDays/365);
 const alternativeBenefit=purchaseAmount(x)*rate*days/365;
 return {supplierCharge,alternativeBenefit,savings:alternativeBenefit-supplierCharge};
}
export function atTerm(x,term){
 const rate=alternative(x).rate,operating=x.delivery+x.warehouse+x.customer;
 const financingDays=Math.max(0,operating-term),paidDays=Math.max(0,term-freeTerm(x));
 const ownCostKg=x.pricePerKg*rate*financingDays/365;
 // A markup is charged only when the supplier actually extends beyond the free term.
 const supplierCostKg=x.pricePerKg*(x.conditionMode==='free'||paidDays<=0?0:x.conditionMode==='markup'?x.markupRate:x.supplierRate*paidDays/365);
 const surplusDays=Math.max(0,term-operating),surplusValueKg=x.pricePerKg*rate*surplusDays/365;
 return {term,financingDays,paidDays,ownCostKg,supplierCostKg,surplusDays,surplusValueKg,totalKg:x.pricePerKg+ownCostKg+supplierCostKg-surplusValueKg};
}
// Who funds each day of the operating cycle when we pay on day `term`.
// supplierFree+supplierPaid+ours equals the operating cycle (plus |term| on prepayment);
// customer counts days beyond the cycle when the customer's money is already with us.
export function daySplit(x,term,free=freeTerm(x)){
 const operating=x.delivery+x.warehouse+x.customer,covered=Math.min(Math.max(0,term),operating);
 const supplierFree=Math.min(covered,Math.max(0,free));
 return {operating,term,supplierFree,supplierPaid:covered-supplierFree,ours:Math.max(0,operating-term),customer:Math.max(0,term-operating)};
}
export function calculate(x){
 x={...x,amount:purchaseAmount(x)};validate(x);
 const alt=alternative(x),days=x.desired-x.current,creditDays=Math.max(0,days),free=freeTerm(x),extraDays=Math.max(0,x.desired-free),quote=atDays(x,extraDays);
 const equivalentRate=x.conditionMode==='free'?0:x.conditionMode==='annual'?x.supplierRate:extraDays>0?x.markupRate*365/extraDays:null;
 const totalCycle=x.delivery+x.warehouse+x.customer;
 const currentCycle=totalCycle-x.current,proposalCycle=totalCycle-x.desired;
 const financingBefore=Math.max(0,currentCycle),financingAfter=Math.max(0,proposalCycle),coveredDays=financingBefore-financingAfter;
 const maxMarkup=alt.rate*Math.max(0,days)/365;
 const selfFinancingDays=Math.max(0,totalCycle-free),kgSelf=x.pricePerKg*(1+alt.rate*(totalCycle-free)/365);
 const ownCreditKg=x.pricePerKg*alt.rate*extraDays/365;
 const supplierCreditKg=atTerm(x,x.desired).supplierCostKg;
 const sameTermDifference=supplierCreditKg-ownCreditKg;
 const offer=atTerm(x,x.desired);
 const kgBefore=x.pricePerKg*(1+alt.rate*currentCycle/365),kgAfter=offer.totalKg,kgDifference=kgAfter-kgBefore;
 const savings=x.amount*alt.rate*days/365-quote.supplierCharge;
 const cashRate=x.amountBasis==='annual'?x.amount/365:x.amount;
 const surplusBefore=cashRate*(x.amountBasis==='annual'?Math.max(0,-currentCycle):currentCycle<0?1:0),surplusAfter=cashRate*(x.amountBasis==='annual'?Math.max(0,-proposalCycle):proposalCycle<0?1:0);
 const annualVolume=x.annualPurchases*(x.purchasePeriod==='monthly'?12:1);
 const dayFrozen=annualVolume/365,dayAnnualCost=dayFrozen*alt.rate;
 const cycleGrowth=currentCycle-x.cycleBefore,capitalAdded=dayFrozen*cycleGrowth,capitalReduction=dayFrozen*days,capitalAfter=capitalAdded-capitalReduction;
 // A batch releases its principal for D days; annual purchases release an
 // average A*D/365 balance continuously. Their benefit formula is identical.
 const released=x.amountBasis==='annual'?x.amount*creditDays/365:creditDays>0?x.amount:0;
 const decision=days<=0?'noExtension':Math.abs(kgDifference)<1e-12?'equal':kgDifference<0?'good':'bad';
 const markup=x.conditionMode==='free'||extraDays<=0?0:x.conditionMode==='markup'?x.markupRate:x.supplierRate*extraDays/365;
 const supplierBenchmarkCost=x.chinaRate===null?null:x.amount*x.chinaRate*extraDays/365;
 const ownerKgBefore=x.pricePerKg*(1+alt.rate*x.cycleBefore/365),ownerKgAfter=kgBefore,ownerKgDifference=ownerKgAfter-ownerKgBefore;
 const optimal=[0,180,Math.max(0,Math.min(180,totalCycle)),Math.max(0,Math.min(180,x.current)),Math.max(0,Math.min(180,free))].sort((a,b)=>a-b).reduce((best,term)=>atTerm(x,term).totalKg<atTerm(x,best).totalKg-1e-12?term:best,0);
 const batches=x.batchesPerYear??12,batchKg=(x.volumeKg??x.amount/x.pricePerKg)/(x.amountBasis==='annual'?batches:1),annualKg=batchKg*batches;
 return {...quote,splitBefore:daySplit(x,x.current,x.current),splitAfter:daySplit(x,x.desired,free),splitSelf:daySplit(x,free,free),batches,batchKg,annualKg,free,extraDays,amount:x.amount,volumeKg:x.volumeKg??x.amount/x.pricePerKg,retainedMoneyDays:x.amount*creditDays,lessCreditDays:Math.max(0,coveredDays),customerAddedDays:Math.max(0,Math.max(0,-proposalCycle)-Math.max(0,-currentCycle)),customerMoneyDays:x.amount*Math.max(0,-proposalCycle),ownCostKgBefore:x.pricePerKg*alt.rate*financingBefore/365,operatingCycle:totalCycle,surplusValueKgBefore:x.pricePerKg*alt.rate*Math.max(0,-currentCycle)/365,surplusValueKg:offer.surplusValueKg,cashBenefit:x.amount*alt.rate*days/365,ownFundsReleased:released,surplusBefore,surplusAfter,surplusGrowth:surplusAfter-surplusBefore,surplusDaysBefore:Math.max(0,-currentCycle),surplusDaysAfter:Math.max(0,-proposalCycle),kgSelf,selfFinancingDays,selfResidualCostKg:x.pricePerKg*alt.rate*Math.max(0,selfFinancingDays-extraDays)/365,selfSurplusValueKg:x.pricePerKg*alt.rate*Math.max(0,Math.max(free,x.desired)-totalCycle)/365,ownCreditKg,supplierCreditKg,sameTermDifference,selfDifference:kgAfter-kgSelf,workingCapitalSavings:x.amount*alt.rate*days/365-quote.supplierCharge,workingCapitalBenefit:x.amount*alt.rate*days/365,alternativeBenefit:x.amount*alt.rate*days/365,savings,financingBefore,financingAfter,coveredDays,ownCostKg:offer.ownCostKg,supplierCostKg:offer.supplierCostKg,optimal,kgBefore,kgAfter,kgDifference,ownerKgBefore,ownerKgAfter,ownerKgDifference,days,creditDays,alternativeRate:alt.rate,alternativeSource:alt.source,equivalentRate,maxMarkup,maxPremium:x.amount*maxMarkup,markup,quotedAmount:x.amount+quote.supplierCharge,released,decision,totalCycle,currentCycle,proposalCycle,annualVolume,cycleGrowth,capitalAdded,capitalReduction,capitalAfter,capitalAnnualCost:capitalAdded*alt.rate,capitalAfterAnnualCost:capitalAfter*alt.rate,dayFrozen,dayAnnualCost,currentFrozen:dayFrozen*financingBefore,proposalFrozen:dayFrozen*financingAfter,currentAnnualCost:dayFrozen*financingBefore*alt.rate,proposalAnnualCost:dayFrozen*financingAfter*alt.rate,impliedKg:x.volumeKg??x.amount/x.pricePerKg,supplierBenchmarkCost,supplierSpread:supplierBenchmarkCost===null?null:quote.supplierCharge-supplierBenchmarkCost};
}

// Working capital in euros: how much the deferral frees, when, and what that money costs per year.
// With a target amount it solves for the deferral that frees it and its break-even supplier price.
export function cashFlow(x,target=x.cashTarget??null){
 const r=calculate(x),rate=r.alternativeRate,annual=r.annualKg*x.pricePerKg,daily=annual/365;
 const frozenBefore=daily*r.financingBefore,frozenAfter=daily*r.financingAfter,released=daily*r.days,fromGap=frozenBefore-frozenAfter;
 const supplierAnnual=annual*r.supplierCostKg/x.pricePerKg,ourAnnual=released*rate;
 const out={dayFrozen:daily,dayCost:daily*rate,annual,daily,frozenBefore,frozenAfter,released,fromGap,fromCustomer:released-fromGap,transitionDays:r.days,batchesSkipped:r.days*r.batches/365,supplierAnnual,ourAnnual,savingsAnnual:ourAnnual-supplierAnnual,ourRate:rate,target:null};
 if(target!=null&&target>0&&daily>0){
  const extra=Math.ceil(target/daily-1e-9),term=x.current+extra,t=calculate({...x,desired:term}),freed=daily*extra;
  const tSupplier=annual*t.supplierCostKg/x.pricePerKg,tOurs=freed*rate;
  out.target={amount:target,extraDays:extra,term,freed,maxRate:rate,maxMarkup:rate*Math.max(0,term-t.free)/365,supplierAnnual:tSupplier,ourAnnual:tOurs,savingsAnnual:tOurs-tSupplier,kgAfter:t.kgAfter,fromCustomer:Math.max(0,freed-frozenBefore)};
 }
 return out;
}

// Bounded sampling, exact stage/term anchors, and independently live markers.
export function graphData(x){
 const r=calculate(x),low=Math.min(0,x.current,x.desired,r.free),high=Math.max(180,r.operatingCycle,x.current,x.desired,r.free);
 const terms=[...Array.from({length:181},(_,i)=>low+(high-low)*i/180),x.current,x.desired,r.free,r.operatingCycle];
 const series=[...new Set(terms)].sort((a,b)=>a-b).map(term=>({term,totalKg:atTerm(x,term).totalKg}));
 return {low,high,series,baseline:r.kgBefore,current:{term:x.current,totalKg:atTerm(x,x.current).totalKg},selected:{term:x.desired,totalKg:r.kgAfter},cycle:r.operatingCycle,free:r.free,stages:{delivery:x.delivery,warehouse:x.warehouse,customer:x.customer},rates:{supplier:x.supplierRate,ours:x.ownerRate,effective:r.alternativeRate},mode:x.conditionMode};
}
