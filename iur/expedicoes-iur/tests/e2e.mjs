import { chromium } from 'playwright';
// Teste ponta a ponta: rode com `npm run test:e2e` (ver tests/run-e2e.sh)
const B=(process.env.BASE||'http://localhost:8766')+'/index.html';
const SHOTS=process.env.SHOTS||'tests/screenshots';
import fs from 'node:fs'; fs.mkdirSync(SHOTS,{recursive:true});
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:420,height:900}, timezoneId:'America/Sao_Paulo', colorScheme:'dark'});
const pg=await ctx.newPage(); const errs=[];
pg.on('pageerror',e=>errs.push('PAGEERR '+e.message)); pg.on('console',m=>{ if(m.type()==='error') errs.push(m.text()); });
await pg.route(/fonts\./, r=>r.abort());
await ctx.route(/photon\.komoot\.io/, r=>r.fulfill({contentType:'application/json', headers:{'access-control-allow-origin':'*'}, body: JSON.stringify({features:[{geometry:{coordinates:[-40.30,-20.40]},properties:{name:'Barra do Jucu',city:'Vila Velha',state:'Espírito Santo'}},{geometry:{coordinates:[-40.1,-20.2]},properties:{name:'Praia de Guriri',city:'São Mateus',state:'Espírito Santo'}}]})}));
const w=(ms=250)=>pg.waitForTimeout(ms);
await pg.goto(B); await pg.evaluate(()=>localStorage.clear()); await pg.reload(); await w(600);
await pg.click('#doImport'); await w(500);
// equipe
await pg.goto(B+'#/equipe'); await w();
for (const [n,m,r] of [['Leonardo','leo@gmail.com','editor'],['Ana Souza','ana@gmail.com','member'],['Bia Lima','bia@gmail.com','producer']]) { await pg.fill('#t-name',n); await pg.fill('#t-mail',m); await pg.selectOption('#t-role',r); await pg.click('#tform button[type=submit]'); await w(); }
await pg.fill('[data-name="fdesigner@gmail.com"]','Felipe'); await pg.press('[data-name="fdesigner@gmail.com"]','Tab'); await w();
console.log('team rows', await pg.locator('.row.static').count());
// home
await pg.goto(B+'#/'); await w();
console.log('home cards', await pg.locator('a.card').count(), await pg.locator('a.card .pill').first().innerText());
const pid = await pg.locator('a.card').first().getAttribute('href'); console.log(pid);
// equipe do projeto
await pg.goto(B+pid+'/equipe'); await w();
await pg.selectOption('#addp','ana@gmail.com'); await w(); await pg.check('input[value=som]'); await pg.click('#fok'); await w();
await pg.selectOption('#addp','leo@gmail.com'); await w(); await pg.check('input[value=direcao]'); await pg.click('#fok'); await w();
await pg.selectOption('#addp','bia@gmail.com'); await w(); await pg.check('input[value=producao]'); await pg.click('#fok'); await w();
await pg.click('[data-funcs="fdesigner@gmail.com"]'); await w(); await pg.check('input[value=dirfoto]'); await pg.check('input[value=producao]'); await pg.click('#fok'); await w();
console.log('team order', (await pg.locator('.row.static .name').allInnerTexts()).join(' > '));
// blocos
await pg.goto(B+pid+'/diarias'); await w();
await pg.fill('#d-s','2026-11-10'); await pg.fill('#d-e','2026-11-12'); await pg.fill('#d-l','Expedição 2'); await pg.click('#dform button'); await w(400);
console.log('blocks', (await pg.locator('.block .ghead h2').allInnerTexts()).join(' | '), 'days', await pg.locator('.dayrow-link').count());
// diária 08/10
await pg.goto(B+pid+'/diaria/2026-10-08'); await w(400);
await pg.fill('#d-info','Maré baixa às 10h'); await pg.press('#d-info','Tab'); await w();
const f1 = await pg.locator('[data-addex]').first().getAttribute('data-addex');
await pg.fill('#fl-'+f1,'Manguezal da Barra do Jucu'); await pg.press('#fl-'+f1,'Tab'); await w();
await pg.click('[data-addex]'); await w();
await pg.fill('#fx-'+f1+'-0-t','14:30'); await pg.press('#fx-'+f1+'-0-t','Tab'); await w();
await pg.fill('#fx-'+f1+'-0-x','Mudança para a praia de Guriri'); await pg.press('#fx-'+f1+'-0-x','Tab'); await w();
await pg.click('#addFront'); await w(400);
const fids = await pg.locator('[data-addex]').evaluateAll(n=>n.map(x=>x.dataset.addex)); console.log('fronts', fids.length);
await pg.fill('#fl-'+fids[1],'Ilha do Frade (drone)'); await pg.press('#fl-'+fids[1],'Tab'); await w();
await pg.click('[data-tperson="'+fids[1]+'|leo@gmail.com"]'); await w();
await pg.click('[data-tveh="'+fids[1]+'|hilux"]'); await w();
// equipamentos do dia: tela separada, aberta pelo botão
console.log('equip button', await pg.locator('#openEquip').count(), 'equip inline', await pg.locator('#allTo').count());
await pg.click('#openEquip'); await w(400); console.log('equip url', pg.url().split('#')[1]);
await pg.selectOption('#allTo', f1+'|toro'); await w();
await pg.selectOption('[data-dest="SUB-14"]', fids[1]+'|hilux'); await w();
await pg.screenshot({path:SHOTS+'/e1.png',fullPage:true});
await pg.goto(B+pid+'/diaria/2026-10-08'); await w(400);
const d = await pg.evaluate(([p])=>window.__db()['projects/'+p+'/days']['2026-10-08'], [pid.split('/')[2]]);
console.log('day', JSON.stringify({info:d.info, fronts:d.fronts.map(f=>({n:f.name,l:f.local,ex:f.extra,p:f.people,v:f.vehicles})), items:d.items}));
// mapa
await pg.fill('#pq-'+f1,'Barra do'); await w(900);
console.log('sugg', await pg.locator('#ps-'+f1+' [data-pick]').count());
await pg.locator('#ps-'+f1+' [data-pick]').first().dispatchEvent('mousedown'); await w(400);
await pg.fill('#pl-'+fids[1],'https://maps.app.goo.gl/abc123'); await pg.press('#pl-'+fids[1],'Tab'); await w(400);
// motorista e passageiros
await pg.selectOption('#dr-'+f1+'-toro','fdesigner@gmail.com'); await w();
await pg.click('[data-seat="'+f1+'|toro|ana@gmail.com"]'); await w();
await pg.selectOption('#dr-'+fids[1]+'-hilux','leo@gmail.com'); await w();
const d2 = await pg.evaluate(([p])=>window.__db()['projects/'+p+'/days']['2026-10-08'], [pid.split('/')[2]]);
console.log('places', JSON.stringify(d2.fronts.map(f=>f.place)));
console.log('seats', JSON.stringify(d2.fronts.map(f=>f.seats)));
await pg.click('[data-ack]'); await w();
await pg.screenshot({path:SHOTS+'/d1.png',fullPage:true});
// resumo
await pg.goto(B+pid); await w(400); await pg.screenshot({path:SHOTS+'/r1.png',fullPage:true});
// como membro
const pm=await ctx.newPage(); pm.on('pageerror',e=>errs.push('M PAGEERR '+e.message));
await pm.route(/fonts\./, r=>r.abort());
await pm.goto(B.replace('index.html','index.html?as=ana@gmail.com')+'#/'); await pm.waitForTimeout(600);
console.log('member nav', (await pm.locator('#nav .tab').allInnerTexts()).join(','), 'cards', await pm.locator('a.card').count());
await pm.goto(B.replace('index.html','index.html?as=ana@gmail.com')+'#'+pid.slice(1)+'/diaria/2026-10-08'); await pm.waitForTimeout(500);
console.log('member nav2', (await pm.locator('#nav .tab').allInnerTexts()).join(','));
console.log('member inputs (0)', await pm.locator('#view input[type=text], #view textarea').count(), 'equip button (0)', await pm.locator('#openEquip').count(), 'ackBtn', await pm.locator('[data-ack]').innerText());
await pm.click('[data-ack]'); await pm.waitForTimeout(300);
console.log('after ack', await pm.locator('[data-ack]').innerText());
await pm.screenshot({path:SHOTS+'/m1.png',fullPage:true});
// admin muda horário -> ana precisa reconfirmar
await pg.goto(B+pid+'/diaria/2026-10-08'); await w(400);
await pg.fill('#ft-'+f1+'-saida','07:30'); await pg.press('#ft-'+f1+'-saida','Tab'); await w(400);
await pm.reload(); await pm.waitForTimeout(600);
await pm.goto(B.replace('index.html','index.html?as=ana@gmail.com')+'#'+pid.slice(1)); await pm.waitForTimeout(600);
console.log('resumo ack', await pm.locator('.daycard [data-ack]').innerText().catch(()=>'none'));
await pm.locator('.daycard [data-ack]').click(); await pm.waitForTimeout(400);
console.log('resumo ack after', await pm.locator('.daycard [data-ack]').innerText(), '|', await pm.locator('.daycard .ackbox .hint').innerText().catch(()=>''));
await pm.screenshot({path:SHOTS+'/r2.png',fullPage:true});
await pm.goto(B.replace('index.html','index.html?as=ana@gmail.com')+'#'+pid.slice(1)+'/diaria/2026-10-08'); await pm.waitForTimeout(500);
console.log('member after change', await pm.locator('[data-ack]').first().innerText());
// editor não vê etiquetas
const pe=await ctx.newPage(); await pe.route(/fonts\./, r=>r.abort()); await pe.goto(B.replace('index.html','index.html?as=leo@gmail.com')+'#/'); await pe.waitForTimeout(500);
console.log('editor nav', (await pe.locator('#nav .tab').allInnerTexts()).join(','));
await pe.goto(B.replace('index.html','index.html?as=leo@gmail.com')+'#/item/SUB-14'); await pe.waitForTimeout(500);
console.log('editor item sheet', await pe.locator('.sheet').count(), 'qr (0)', await pe.locator('.sheet .qrbox').count());
await pg.goto(B+'#/item/SUB-14'); await w(500); console.log('admin qr (1)', await pg.locator('.sheet .qrbox').count());
// produtor: só Projetos, edita a diária, não vê equipamentos
const pp=await ctx.newPage(); pp.on('pageerror',e=>errs.push('P PAGEERR '+e.message)); await pp.route(/fonts\./, r=>r.abort());
const PB=B.replace('index.html','index.html?as=bia@gmail.com');
await pp.goto(PB+'#/'); await pp.waitForTimeout(500);
console.log('producer nav', (await pp.locator('#nav .tab').allInnerTexts()).join(','), 'cards', await pp.locator('a.card').count());
await pp.goto(PB+'#'+pid.slice(1)); await pp.waitForTimeout(500);
console.log('producer tabs', (await pp.locator('.subtabs .tab').allInnerTexts()).join(','));
await pp.goto(PB+'#'+pid.slice(1)+'/diaria/2026-10-08'); await pp.waitForTimeout(500);
console.log('producer equip button (0)', await pp.locator('#openEquip').count(), 'inputs', await pp.locator('#view input[type=text], #view textarea').count());
await pp.fill('#fl-'+fids[1],'Ilha do Frade'); await pp.press('#fl-'+fids[1],'Tab'); await pp.waitForTimeout(300);
await pp.click('[data-tveh="'+fids[1]+'|hilux"]'); await pp.waitForTimeout(300);
const d3 = await pp.evaluate(([p])=>window.__db()['projects/'+p+'/days']['2026-10-08'], [pid.split('/')[2]]);
console.log('producer saved', d3.fronts[1].local, JSON.stringify(d3.fronts[1].vehicles), 'items intact', JSON.stringify(d3.items));
await pp.goto(PB+'#'+pid.slice(1)+'/diaria/2026-10-08/equipamentos'); await pp.waitForTimeout(400);
console.log('producer equip route -> diaria', await pp.locator('#allTo').count(), await pp.locator('#d-info').count());
await pp.goto(PB+'#'+pid.slice(1)+'/diarias'); await pp.waitForTimeout(400);
console.log('producer vehicles in diarias', await pp.locator('#vform').count());
await pp.screenshot({path:SHOTS+'/p1.png',fullPage:true});
await pm.goto(B.replace('index.html','index.html?as=ana@gmail.com')+'#'+pid.slice(1)+'/diarias'); await pm.waitForTimeout(500);
console.log('member diarias summary', await pm.locator('.summary').count(), 'resumo-free');
await pm.screenshot({path:SHOTS+'/m2.png',fullPage:true});
// sem acesso
const px=await ctx.newPage(); await px.route(/fonts\./, r=>r.abort()); await px.goto(B.replace('index.html','index.html?as=x@gmail.com')); await px.waitForTimeout(500);
console.log('outsider', (await px.locator('#view h2').innerText()));
const real=errs.filter(e=>!/fonts|ERR_FAILED|qrcode|Failed to load resource/.test(e)); // falhas de rede (CDN) não contam
console.log('ERRS', real);
if(real.length) process.exitCode=1;
await b.close();
