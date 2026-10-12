import {defaults,fxReference,createDefaults,calculate,atTerm,validate,convert,toEUR,freeTerm,graphData,cashFlow} from './calculator.js';
import {dictionaries} from './i18n.js';
import {formatNumber,inputNumber,formatCeilingPercent} from './format.js';
import {renderHelp} from './help.js';
const $=s=>document.querySelector(s),key='og-app-v3';
let state={lang:'ru',theme:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light',values:createDefaults()},supplierView=false,offlineReady=false,storageOK=true,legacy=false;
try{const saved=JSON.parse(localStorage.getItem(key));if(saved){validate(saved.values);state={lang:saved.lang??state.lang,theme:saved.theme??state.theme,values:saved.values};}else legacy=Boolean(localStorage.getItem('og-app-v2')||localStorage.getItem('og-app-v1'));}catch{storageOK=false;}
if(!dictionaries[state.lang])state.lang='ru';if(!['light','dark'].includes(state.theme))state.theme='light';let x=state.values;x.batchesPerYear??=12;
// Official rates only; settings for a separate free term, bank rate and manual FX were removed, so saved values are reset.
x.exchangeRates={...defaults.exchangeRates};x.fxDate=defaults.fxDate;x.free=null;x.bankRate=null;if(!['EUR','RUB','CNY'].includes(x.currency))x.currency='EUR';if(x.volumeKg==null)x.volumeKg=x.amount/x.pricePerKg;x.amount=x.pricePerKg*x.volumeKg;
// Per-kg results may be displayed per 100 kg or per tonne; the model always stays per kg.
const plain=k=>dictionaries[state.lang][k]??k,size=()=>x.kgUnitSize??1;
const unitWord=()=>size()===1000?plain('tonUnit'):size()===100?'100 '+plain('kgUnit'):plain('kgUnit');
const relabel=s=>size()===1?s:s.replace(/([зЗ])а кг/g,(_,z)=>z+'а '+unitWord()).replace(/(p|P)er[- ]kg/g,(_,p)=>p+'er '+unitWord()).replace(/每公斤/g,'每'+unitWord());
const t=k=>relabel(plain(k)),locale=()=>({ru:'ru-RU',en:'en-US',zh:'zh-CN'}[state.lang]);
const n=(v,d=2)=>formatNumber(v,locale(),d),symbol=c=>({EUR:'€',RUB:'₽',USD:'$',CNY:'¥'}[c]);
const money=v=>`${n(convert(v,x))} ${symbol(x.currency)}`,kg=v=>money(v*size());
const phrase=(key,values={})=>Object.entries(values).reduce((s,[k,v])=>s.replaceAll('{'+k+'}',v),t(key));
const rates=new Set(['ownerRate','bankRate','supplierRate','markupRate','chinaRate']);
const optional=new Set(['bankRate','chinaRate','free','cashTarget']);
const currencyFields=new Set(['amount','annualPurchases','pricePerKg','cashTarget']);
function node(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function persist(){try{localStorage.setItem(key,JSON.stringify(state));storageOK=true;}catch{storageOK=false;}$('#storage').textContent=storageOK?'':t('storageError');}
function card(k,v,cls='',label=t(k)){const e=node('div',undefined,'metric '+cls);e.dataset.metric=k;if(['kgBefore','kgAfter','kgSelf','kgDifference','effectivePriceKg','financingEffectKg','ownerKgBefore','ownerKgAfter','ownerKgDifference'].includes(k))e.title=t('economicHint');if(k==='ourFundsReleased')e.title=t('retainedHint');if(k==='cashBenefit')e.title=t('cashHint');e.append(node('span',label),node('strong',v));return e;}
function makeField(k){
 const wrap=node('div',undefined,'field'),label=node('label',(k==='pricePerKg'?plain:t)(k==='current'?'supplierCycle':k));label.htmlFor=k;label.title=k==='ownerRate'?t('rateHint'):k==='current'?t('termHint'):k==='fxRate'?t('fxExamples'):label.textContent;
 const row=node('div',undefined,'input-row'),input=node('input');input.id=k;input.type=k==='chinaDate'?'date':'number';
 if(input.type==='number'){input.step=rates.has(k)||currencyFields.has(k)||k==='fxRate'||k==='volumeKg'?'.01':'1';if(!['current','free','desired','cycleBefore','cycleAfter'].includes(k))input.min=['fxRate','pricePerKg'].includes(k)?.01:k==='batchesPerYear'?1:0;input.inputMode=['current','free','desired','cycleBefore','cycleAfter'].includes(k)?'text':'decimal';const raw=k==='volumeKg'?x.volumeKg:k==='fxRate'?x.exchangeRates[x.currency]:k==='cycleAfter'?calculate(x).currentCycle:k==='free'?(x.conditionMode==='free'?x.desired:freeTerm(x)):x[k];if(k==='supplierRate'&&x.conditionMode==='free')input.disabled=true;if(k==='free'&&x.conditionMode==='free')input.disabled=true;input.value=k==='supplierRate'&&x.conditionMode==='free'?'0':raw===null?'':inputNumber(rates.has(k)?raw*100:currencyFields.has(k)?convert(raw,x):raw);input.readOnly=k==='cycleAfter'||k==='fxRate'&&x.currency==='EUR';if(optional.has(k))input.placeholder=t(k==='free'?'current':k==='cashTarget'?'cashTargetPlaceholder':'unavailable');}else input.value=x[k];
 row.append(input);if(k!=='chinaDate')row.append(node('span',k==='batchesPerYear'?'':rates.has(k)?'%':k==='volumeKg'?t('kgUnit'):currencyFields.has(k)||k==='fxRate'?symbol(x.currency):t('days')));
 input.addEventListener('input',()=>update(k,input));wrap.append(label,row);
 if(['desired','supplierRate','markupRate'].includes(k)){const slider=node('input');slider.type='range';slider.id=k==='desired'?'term-slider':'credit-slider';slider.min=0;slider.max=k==='desired'?180:100;slider.step=k==='desired'?1:.01;slider.value=k==='supplierRate'&&x.conditionMode==='free'?0:rates.has(k)?x[k]*100:x[k];slider.disabled=k==='supplierRate'&&x.conditionMode==='free';slider.setAttribute('aria-label',t(k));slider.oninput=()=>{input.value=slider.value;update(k,input);};wrap.append(slider);}
 return wrap;
}
// Header line with the reference rates; flags a manually edited rate.
function renderFx(){const date=d=>d.split('-').reverse().join('.'),manual=['RUB','CNY'].some(c=>Math.abs(x.exchangeRates[c]-fxReference[c].rate)>1e-9);$('#fx-line').textContent=phrase('fxLine',{rub:formatNumber(x.exchangeRates.RUB,locale(),2),cny:formatNumber(x.exchangeRates.CNY,locale(),2),rubSource:t('fxCbr'),rubDate:date(fxReference.RUB.date),cnySource:t('fxEcb'),cnyDate:date(fxReference.CNY.date)})+(manual?' · '+t('fxManual'):'');}
function fillFields(selector,keys){const container=$(selector);container.replaceChildren(...keys.map(makeField));}
function render(){
 document.documentElement.dataset.theme=state.theme;$('#theme').textContent=t(state.theme==='dark'?'lightTheme':'darkTheme');$('#theme').setAttribute('aria-label',t(state.theme==='dark'?'lightTheme':'darkTheme'));
 document.documentElement.lang=state.lang==='zh'?'zh-CN':state.lang;document.title=t('title');document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));$('#language').value=state.lang;
 $('#calculator').hidden=supplierView;$('#supplier-screen').hidden=!supplierView;$('#mobile-dock').hidden=supplierView;$('#view').textContent=t(supplierView?'back':'supplier');
 for(const [id,k] of [['currency','currency'],['amount-basis','amountBasis'],['condition-mode','conditionMode']])$('#'+id).value=x[k];
 renderFx();
 fillFields('#primary-controls',['pricePerKg',x.conditionMode==='markup'?'markupRate':'supplierRate','desired']);$('#unit-size').value=String(size());
 fillFields('#cycle-fields',['delivery','warehouse','customer','current']);
 fillFields('#our-rate-fields',['ownerRate','volumeKg']);fillFields('#batch-fields',['batchesPerYear']);fillFields('#cash-target-field',['cashTarget']);
 fillFields('#benchmark-fields',['chinaRate','chinaDate']);
 $('#install').textContent='';$('#offline').textContent=offlineReady?t('offlineReady'):'';$('#storage').textContent=storageOK?'':t('storageError');$('#legacy').textContent=legacy?t('legacy'):'';
 renderResults();
}
const standalone=false;
function markInvalid(invalid){$('#invalid').textContent=invalid?t('invalid'):'';for(const s of ['#decision-summary','#mobile-dock','#terms-brief','#header-cycle'])$(s).classList.toggle('stale',invalid);if(invalid)$('#decision').textContent=t('stale');}
function update(k,input){
 if(input.readOnly||input.disabled)return;
 if(!input.validity.valid||input.type==='number'&&input.value===''&&!optional.has(k)){input.setAttribute('aria-invalid','true');markInvalid(true);return;}
 let v=input.type==='date'?input.value:input.value===''?null:Number(input.value)/(rates.has(k)?100:1);
 if(input.type==='number'&&v!==null&&!Number.isFinite(v)){markInvalid(true);return;}
 input.removeAttribute('aria-invalid');
 if(k==='fxRate'){x.exchangeRates[x.currency]=v;renderFx();for(const id of currencyFields){const e=$('#'+id);if(e&&x[id]!=null)e.value=inputNumber(convert(x[id],x));}}else x[k]=currencyFields.has(k)?toEUR(v,x):v;
 if(k==='volumeKg'||k==='pricePerKg')x.amount=x.pricePerKg*x.volumeKg;
 const invalid=[...$('#calculator').querySelectorAll('input[type=number],input[type=date]')].some(e=>!e.validity.valid||e.type==='number'&&e.value===''&&!optional.has(e.id));
 markInvalid(invalid);if(!invalid){persist();renderResults();}
}
function renderResults(){
 const r=calculate(x);markInvalid(false);
 const edge=x.desired>=180,good=x.conditionMode!=='annual'||x.supplierRate<r.alternativeRate;$('#edge-note').hidden=!edge;$('#edge-note').classList.toggle('loss',edge&&!good);if(edge)$('#edge-note').textContent=phrase(x.conditionMode==='free'?'edgeFree':x.conditionMode==='markup'?'edgeMarkup':good?'edgeGood':'edgeBad',{supplier:n(x.supplierRate*100),ours:n(r.alternativeRate*100)});
 $('#terms-brief').textContent=phrase(x.conditionMode==='free'?'freeTermsBrief':'termsBrief',{current:n(x.current),free:n(r.free),desired:n(x.desired),days:n(r.extraDays)});
 const condition=x.conditionMode==='free'?t('rateFree'):x.conditionMode==='markup'?phrase('rateMarkup',{rate:n(x.markupRate*100)}):phrase('supplierRatePa',{rate:n(x.supplierRate*100)});
 const rateText=x.conditionMode==='free'?t('rateFree'):x.conditionMode==='markup'?phrase('rateMarkup',{rate:n(x.markupRate*100)}):phrase('rateAnnual',{rate:n(x.supplierRate*100)});
 const ours=n(r.alternativeRate*100),dd=v=>n(v)+' '+t('days'),offer=r.splitAfter,before=r.splitBefore;
 $('#kg-result').textContent=kg(r.kgAfter)+' / '+unitWord();$('#kg-result').title=t('economicHint');
 // Now vs offer: who funds which days of the operating cycle, and what that does to the price per kg.
 $('#split-title').textContent=phrase('splitTitle',{days:n(r.operatingCycle)});
 // The bar runs from day 0 to the later of payment day and cycle end; customer days are striped over the supplier's part.
 const supplierDays=(s,free)=>({free:Math.max(0,Math.min(s.term,free)),paid:Math.max(0,s.term-Math.max(0,free))});
 const total=(s,free)=>{const d=supplierDays(s,free);return d.free+d.paid+s.ours;},scale=Math.max(1,total(before,x.current),total(offer,r.free));
 const split=(s,free,paidRate)=>{const bar=node('div',undefined,'split-bar'),legend=node('div',undefined,'split-legend'),d=supplierDays(s,free);
  for(const [k,days,label] of [['free',d.free,t('segFree')],['paid',d.paid,phrase('segPaid',{rate:paidRate})],['ours',s.ours,phrase('segOurs',{rate:ours})],['customer',s.customer,t('segCustomer')]]){if(days<=0)continue;const seg=node('span',undefined,'seg seg-'+k);seg.style.width=days/scale*100+'%';if(k==='customer')seg.style.left=s.operating/scale*100+'%';seg.title=label+': '+dd(days);bar.append(seg);const chip=node('span',undefined,'chip');chip.append(node('i',undefined,'seg-'+k),node('span',label),node('b',dd(days)));legend.append(chip);}
  return [bar,legend];};
 const line=(label,value,cls='')=>{const e=node('div',undefined,'ledger-row '+cls);e.append(node('span',label),node('strong',value));return e;};
 const ledger=(title,parts,cls)=>{const e=node('div',undefined,'ledger '+cls);e.append(node('h4',title),...parts);return e;};
 const financing=(s,ownKg,customerKg)=>[...(s.ours>0?[line(phrase('ledgerOurs',{days:n(s.ours),rate:ours}),'+'+kg(ownKg))]:[]),...(s.customer>0?[line(phrase('ledgerCustomer',{days:n(s.customer),rate:ours}),kg(-customerKg))]:[])];
 const beforeParts=[...split(before,x.current,''),line(t('ledgerSupplierPrice'),kg(x.pricePerKg)),...financing(before,r.ownCostKgBefore,r.surplusValueKgBefore),line(t('ledgerTotalBefore'),kg(r.kgBefore),'ledger-total')];
 const offerParts=[...split(offer,r.free,rateText),line(r.supplierCostKg>0?phrase('ledgerSupplierCredit',{days:n(r.extraDays),rate:rateText}):t('ledgerSupplierPrice'),kg(x.pricePerKg+r.supplierCostKg)),...financing(offer,r.ownCostKg,r.surplusValueKg),line(t('ledgerTotalAfter'),kg(r.kgAfter),'ledger-total')];
 $('#kg-results').replaceChildren(ledger(phrase('splitNow',{days:n(x.current)}),beforeParts,'before'),ledger(phrase('splitOffer',{days:n(x.desired)}),offerParts,'after'),node('p',phrase('ledgerDifference',{diff:kg(r.kgDifference)}),'ledger-difference'+(r.kgDifference>1e-12?' negative':'')));
 const signed=v=>v>0?'+'+n(v):n(v);
 $('#cycle-equation').textContent=n(r.operatingCycle)+' − ('+n(x.current)+') = '+signed(r.currentCycle)+' '+t('days');
 // Working capital in euros: frozen now vs after, what is released, when, and what it costs per year.
 const c=cashFlow(x),yearly=v=>money(v)+' '+t('perYear');
 $('#cash-title').textContent=phrase('cashTitle',{annual:money(c.annual)});
 const releasedCard=card(c.released>=0?'cashReleased':'cashNeeded',money(Math.abs(c.released)),'hero '+(c.released>=0?'positive':'negative'));releasedCard.append(node('span',t('cashOnce'),'small'));
 // The released amount depends on days only; the supplier rate sets its yearly price.
 const releasedCost=c.released>0?phrase('cashReleasedCost',{supplier:yearly(c.supplierAnnual),condition,ours:yearly(c.ourAnnual),rate:n(c.ourRate*100)}):'';if(releasedCost)releasedCard.append(node('span',releasedCost,'small released-cost'));if(c.fromCustomer>1e-9&&c.fromGap>1e-9)releasedCard.append(node('span',phrase('cashSplit',{gap:money(c.fromGap),customer:money(c.fromCustomer)}),'small'));
 // What the owner keeps in the business to fund the cash cycle from the header, and its yearly cost.
 const frozen=(k,v,days)=>{const e=card(k,money(v));e.append(node('span',phrase('cashCycleDays',{days:n(days),cost:yearly(v*c.ourRate)}),'small'));return e;};
 $('#cash-results').replaceChildren(frozen('cashFrozenBefore',c.frozenBefore,r.currentCycle),frozen('cashFrozenAfter',c.frozenAfter,r.proposalCycle),releasedCard);
 $('#cash-when').textContent=c.released>0?phrase('cashWhen',{days:n(c.transitionDays),batches:n(c.batchesSkipped),amount:money(c.released)}):'';
 // One day of the cycle in cash.
 $('#cash-day').textContent=phrase('cashDay',{frozen:money(c.dayFrozen),cost:yearly(c.dayCost)});
 const goal=c.target,goalBox=$('#cash-target-results');goalBox.replaceChildren();
 if(goal){const apply=node('button',t('cashApply'),'quiet');apply.onclick=()=>{x.desired=goal.term;persist();render();};
  goalBox.append(card('cashTargetTerm',phrase('cashTargetTermValue',{term:n(goal.term),extra:n(goal.extraDays)}),'hero'),(()=>{const e=card('cashTargetMaxRate',phrase('cashTargetMaxRateValue',{rate:n(goal.maxRate*100)}));e.append(node('span',phrase('cashTargetMaxMarkup',{markup:formatCeilingPercent(goal.maxMarkup,locale())}),'small'));return e;})(),(()=>{const e=card('cashTargetCost',yearly(goal.savingsAnnual),goal.savingsAnnual<0?'negative':'positive');e.append(node('span',phrase('cashTargetCostValue',{supplier:yearly(goal.supplierAnnual),ours:yearly(goal.ourAnnual)}),'small'));return e;})(),card('cashTargetKg',kg(goal.kgAfter)+' / '+unitWord()));
  if(goal.fromCustomer>1e-9)goalBox.append(node('p',phrase('cashTargetCustomer',{gap:money(c.frozenBefore),rest:money(goal.fromCustomer)}),'small'));
  goalBox.append(apply);}
 // Effect per batch and per year: per-kg effect times batch / annual kilograms.
 const effectCard=(key,perKg,cls='')=>{const e=card(key,money(perKg*r.batchKg),cls);e.append(node('span',t('effectPerBatch'),'effect-basis'),node('span',phrase('effectPerYear',{value:money(perKg*r.annualKg)}),'effect-year'),node('span',kg(perKg)+' / '+unitWord(),'effect-unit'));return e;};
 $('#effect-title').textContent=phrase('effectTitle',{batch:n(r.batchKg),batches:n(r.batches),annual:n(r.annualKg)});$('#deferral-effect').replaceChildren(effectCard('cashBenefit',x.pricePerKg*r.alternativeRate*r.days/365),effectCard('supplierCharge',r.supplierCostKg),effectCard('cashNetBenefit',-r.kgDifference,r.kgDifference>1e-12?'negative':'positive'));
 $('#cycle-label').textContent=signed(r.currentCycle)+' → '+signed(r.proposalCycle)+' '+t('days');$('#operating-total').textContent=t('operatingCycle')+': '+n(x.delivery)+' + '+n(x.warehouse)+' + '+n(x.customer)+' = '+signed(r.operatingCycle)+' '+t('days');cycleDiagram(r);
 $('#term-slider').value=x.desired;$('#credit-slider').value=x.conditionMode==='free'?0:x.conditionMode==='annual'?x.supplierRate*100:x.markupRate*100;
 $('#summary-rate').textContent=r.equivalentRate===null?t('undefinedRate'):phrase('summaryRate',{rate:n(r.equivalentRate*100)});
 $('#comparison').textContent=phrase('comparison',{rate:n(r.alternativeRate*100),source:t(r.alternativeSource)});$('#decision').textContent=t(r.decision);
 $('#decision-summary').classList.toggle('loss',r.kgDifference>1e-12);$('#decision-summary').classList.toggle('neutral',Math.abs(r.kgDifference)<1e-12);
 $('#dock-result').textContent=kg(r.kgAfter)+' / '+unitWord();$('#dock-ceiling').textContent=kg(r.kgDifference)+' / '+unitWord();
 renderArguments($('#args-body'),r,false);renderArguments($('#supplier-args-body'),r,true);
 // Supplier view: read-only summary of the main screen (price, term, the supplier's own income); no internal rates.
 $('#supplier-headline').textContent=phrase('supplierHeadline',{desired:n(x.desired),condition});
 $('#supplier-terms').textContent=phrase('supplierTermsLine',{current:n(x.current),desired:n(x.desired),days:n(r.extraDays),condition});
 // Now vs new term: price per selected unit without / with the cost of money, money in the business, and what is released.
 const signedMoney=v=>(v>1e-9?'+':'')+money(v),signedKg=v=>(v>1e-9?'+':'')+kg(v),table=node('table',undefined,'comparison-table supplier-table'),head=node('tr');
 const cols=[phrase('supplierNow',{days:n(x.current)}),phrase('supplierOffer',{days:n(x.desired)}),t('supplierChange')];head.append(node('th',''),...cols.map(v=>node('th',v)));table.append(head);
 for(const [key,a,b,d,cls] of [['supplierPriceInvoice',kg(x.pricePerKg),kg(x.pricePerKg+r.supplierCostKg),signedKg(r.supplierCostKg),''],['supplierPriceMoney',kg(r.kgBefore),kg(r.kgAfter),signedKg(r.kgDifference),'comparison-total'],['supplierCash',money(c.frozenBefore),money(c.frozenAfter),signedMoney(c.frozenAfter-c.frozenBefore),'']]){const tr=node('tr',undefined,cls);tr.append(node('th',t(key)),...[a,b,d].map((v,i)=>{const td=node('td',v);td.dataset.col=[t('supplierNowShort'),t('supplierOfferShort'),t('supplierChange')][i];return td;}));table.append(tr);}
 const releasedRow=node('p',phrase(c.released>=0?'supplierReleased':'supplierNeeded',{amount:money(Math.abs(c.released))}),'supplier-released'+(c.released<0?' negative':''));
 $('#supplier-values').replaceChildren(table,releasedRow,...(releasedCost?[node('p',releasedCost,'released-cost')]:[]));
 chart();refreshHelp();
}
function renderArguments(container,r,forSupplier){const batchSum=money(x.pricePerKg*r.batchKg),batchCharge=money(r.supplierCostKg*r.batchKg);
 container.replaceChildren(node('p',t('argsChina')),node('p',t('argsWin')));
 container.append(node('p',x.conditionMode==='free'?phrase('publicFreeExample',{desired:n(x.desired),amount:batchSum}):r.extraDays>0?phrase('publicExample',{amount:batchSum,days:n(r.extraDays),charge:batchCharge,rate:n(r.equivalentRate*100)}):t('publicNoDays'),'public-example'));
 if(x.chinaRate===null){if(!forSupplier)container.append(node('p',t('chinaMissing'),'muted'));}else{container.append(node('p',phrase('reference',{rate:n(x.chinaRate*100),date:x.chinaDate||t('noDate')})),node('p',t('chinaDisclaimer'),'muted'));if(r.extraDays>0)container.append(card('supplierSpread',money(r.supplierSpread)));}
}
function cycleDiagram(r){
 const svg=$('#cycle-diagram');svg.replaceChildren();svg.dataset.graph=JSON.stringify({delivery:x.delivery,warehouse:x.warehouse,customer:x.customer,current:x.current,desired:x.desired,ours:r.alternativeRate,supplier:r.equivalentRate,mode:x.conditionMode,cycle:r.operatingCycle,currentCycle:r.currentCycle,proposalCycle:r.proposalCycle});const fontSize=matchMedia('(max-width:699px)').matches?24:16;const ink=getComputedStyle(document.documentElement).getPropertyValue('--plot-ink').trim();const ns='http://www.w3.org/2000/svg',lo=Math.min(0,x.current,x.desired),hi=Math.max(1,r.totalCycle,x.current,x.desired),X=v=>45+(v-lo)/(hi-lo)*510;
 function el(tag,a,text){const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(a))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;svg.append(e);}
 let start=0;for(const [k,color]of [['delivery','#4a90b5'],['warehouse','#12695b'],['customer','#c88b2e']]){el('rect',{x:X(start),y:4,width:(x[k]/(hi-lo)*510),height:14,fill:color});start+=x[k];}
 for(const [v,y,color,label]of [[x.current,54,'#536c9a',t('currentMarker')],[x.desired,96,r.kgDifference>1e-12?'#db8c27':'#12695b',t('legendDesired')]]){el('line',{x1:X(Math.min(0,v)),x2:X(Math.max(0,v)),y1:y,y2:y,stroke:color,'stroke-width':8});el('text',{x:45,y:y-10,'font-size':fontSize,fill:ink},label+': '+n(v)+' '+t('days'));}
 svg.setAttribute('aria-label',t('financialCycle')+': '+n(r.currentCycle)+' → '+n(r.proposalCycle)+' '+t('days')+' · '+kg(r.kgAfter)+' / '+unitWord());
}
function chart(){
 const svg=$('#chart');svg.replaceChildren();const css=getComputedStyle(document.documentElement),ink=css.getPropertyValue('--plot-ink').trim(),grid=css.getPropertyValue('--plot-grid').trim(),curve=css.getPropertyValue('--plot-line').trim();const ns='http://www.w3.org/2000/svg',data=graphData(x),values=data.series.map(p=>p.totalKg),baseline=data.baseline;svg.dataset.graph=JSON.stringify(data);
 function el(tag,a,text){const e=document.createElementNS(ns,tag);for(const [k,v]of Object.entries(a))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;svg.append(e);return e;}
 let lo=Math.min(...values,baseline),hi=Math.max(...values,baseline);const pad=Math.max((hi-lo)*.1,.001);lo-=pad;hi+=pad;const X=d=>80+(d-data.low)/(data.high-data.low)*480,Y=v=>180-(v-lo)/(hi-lo)*150;
 for(let i=0;i<4;i++){const v=lo+(hi-lo)*i/3;el('line',{x1:80,y1:Y(v),x2:560,y2:Y(v),stroke:grid});el('text',{x:74,y:Y(v)+4,'text-anchor':'end','font-size':11,fill:ink},n(convert(v*size(),x)));}
 for(let i=0;i<=6;i++){const d=data.low+(data.high-data.low)*i/6;el('text',{x:X(d),y:203,'text-anchor':'middle','font-size':12,fill:ink},n(d));}
 el('line',{x1:X(data.cycle),x2:X(data.cycle),y1:24,y2:180,stroke:grid,'stroke-dasharray':'3 3'});el('text',{x:X(data.cycle),y:16,'text-anchor':X(data.cycle)>480?'end':X(data.cycle)<150?'start':'middle','font-size':11,fill:ink},t('operatingCycle')+' '+n(data.cycle));
 el('line',{x1:80,x2:560,y1:Y(baseline),y2:Y(baseline),stroke:'#536c9a','stroke-dasharray':'5 4'});
 el('path',{d:data.series.map((p,i)=>(i?'L':'M')+X(p.term)+','+Y(p.totalKg)).join(' '),stroke:curve,'stroke-width':3,fill:'none'});
 for(const [point,color]of [[data.current,'#536c9a'],[data.selected,'#db8c27']]){const marker=el('circle',{cx:X(point.term),cy:Y(point.totalKg),r:5,fill:color});marker.dataset.term=point.term;marker.setAttribute('aria-label',n(point.term)+' '+t('days')+': '+kg(point.totalKg));}
 svg.setAttribute('aria-label',t('chart')+' · '+t('desired')+': '+n(x.desired)+' '+t('days'));
}
function refreshHelp(){renderHelp({lang:state.lang,labels:dictionaries[state.lang],supplierView});}
$('#theme').onclick=()=>{state.theme=state.theme==='dark'?'light':'dark';persist();render();};
$('#language').onchange=e=>{state.lang=e.target.value;persist();render();};
for(const [id,k] of [['currency','currency'],['amount-basis','amountBasis'],['condition-mode','conditionMode']])$('#'+id).onchange=e=>{x[k]=e.target.value;persist();render();};
$('#unit-size').onchange=e=>{x.kgUnitSize=Number(e.target.value);persist();render();};
$('#view').onclick=()=>{supplierView=!supplierView;render();window.scrollTo(0,0);};
render();
if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').then(async()=>{await navigator.serviceWorker.ready;offlineReady=true;$('#offline').textContent=t('offlineReady');}).catch(()=>{});
