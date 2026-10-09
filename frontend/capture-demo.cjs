// Reproduce the README screenshot and silent demo recording from the built console.
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
(async()=>{
 const root=path.resolve(__dirname,'..');
 fs.mkdirSync(path.join(root,'docs/assets'),{recursive:true});
 const server=spawn(process.execPath,[path.join(__dirname,'node_modules/vite/bin/vite.js'),'preview','--host','127.0.0.1','--port','4175'],{cwd:__dirname,stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<30;i++){try{if((await fetch('http://127.0.0.1:4175')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1050},recordVideo:{dir:path.join(root,'demo'),size:{width:1280,height:934}}});
  const page=await context.newPage();await page.goto('http://127.0.0.1:4175');
  await page.getByRole('button',{name:'Start scenario'}).click();
  await page.waitForTimeout(8500);
  await page.getByRole('button',{name:'Request sandbox transfer'}).click();
  await page.waitForTimeout(1000);await page.getByRole('button',{name:'Create approval request'}).click();
  await page.screenshot({path:path.join(root,'docs/assets/dashboard.jpg'),type:'jpeg',quality:85,fullPage:true});
  await page.waitForTimeout(1500);await page.getByRole('button',{name:'Review approval'}).click();
  await page.waitForTimeout(2000);await page.getByRole('button',{name:'Approve exact details'}).click();
  await page.waitForTimeout(1000);await page.getByRole('button',{name:'Execute sandbox transfer'}).click();
  await page.waitForTimeout(1000);await page.getByRole('button',{name:'Audit trail',exact:true}).click();
  await page.waitForTimeout(2000);
  const video=page.video();await context.close();const file=await video.path();fs.renameSync(file,path.join(root,'demo/walkthrough.webm'));
  console.log('Saved screenshot and actual silent browser walkthrough.');
 }finally{await browser?.close();server.kill();}
})().catch(e=>{console.error(e);process.exit(1)});
