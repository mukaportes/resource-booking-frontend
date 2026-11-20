import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'node:fs';
const browser = await chromium.launch({headless:true});
const observations = { revision:'ecbfc38', browser:browser.version(), timestamp:new Date().toISOString() };
const context = await browser.newContext({timezoneId:'UTC',viewport:{width:1440,height:1000}});
const page = await context.newPage();
try {
 await page.clock.setFixedTime(new Date('2027-01-11T08:00:00Z'));
 await page.goto('http://127.0.0.1:3100/?view=day&date=2027-03-14');
 await page.getByLabel('Work email').fill('audit@example.com');
 await page.getByRole('button',{name:'Open workspace'}).click();
 await page.getByRole('button',{name:'＋ New booking'}).click();
 observations.resourceValidation = await page.getByRole('dialog').evaluate(dialog => ({
  message:dialog.querySelector('#booking-validation').textContent,
  resourceInvalid:dialog.querySelector('#booking-resource').getAttribute('aria-invalid'),
  resourceDescription:dialog.querySelector('#booking-resource').getAttribute('aria-describedby'),
  times:[...dialog.querySelectorAll('input')].map(input => ({type:input.type,value:input.value,invalid:input.getAttribute('aria-invalid')}))
 }));
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Choose schedule date'}).click();
 observations.scheduleDatePicker={viewedDate:'2027-03-14',pickerText:await page.locator('.atlas-date-picker').innerText()};
 await page.keyboard.press('Escape');
 observations.denseFixture = await page.evaluate(() => {
  const users=Array.from({length:100},(_,i)=>({userId:crypto.randomUUID(),email:`member${i}@example.com`,createdAt:0}));
  const resources=['room-1','room-2','room-3','computer-1','computer-2','tablet-1','tablet-2'];
  const base=Date.parse('2027-01-11T00:00:00Z');
  const items=Array.from({length:5000},(_,i)=>({id:i+1,userId:users[i%100].userId,resourceId:resources[i%7],startAt:i<2352?base+Math.floor(i/7)*1800000:base-86400000-i*1800000,endAt:i<2352?base+(Math.floor(i/7)+1)*1800000:base-86400000-(i-1)*1800000,status:i<2352?'active':'cancelled',createdAt:0,cancelledAt:i<2352?null:1}));
  const raw={users:JSON.stringify({schemaVersion:1,items:users}),bookings:JSON.stringify({schemaVersion:1,items}),bookingSequence:JSON.stringify({schemaVersion:1,lastIssuedId:5000})};
  Object.entries(raw).forEach(([key,value]) => localStorage.setItem(`resourceBooking:v1:${key}`,value));
  sessionStorage.setItem('resourceBooking:v1:session',JSON.stringify({schemaVersion:1,session:{userId:users[0].userId}}));
  return {records:5000,users:100,activeVisible:2352,cancelledHistory:2648,bytes:Object.values(raw).reduce((n,s)=>n+new TextEncoder().encode(s).length,0)};
 });
 const start=performance.now();
 await page.goto('http://127.0.0.1:3100/?view=week&date=2027-01-12');
 await page.locator('.fc-event[role="button"]').first().waitFor();
 observations.denseCalendar={loadMs:performance.now()-start,eventCount:await page.locator('.fc-event[role="button"]').count()};
 observations.denseCalendar.minimumEventWidth = await page.locator('.fc-event[role="button"]').evaluateAll(events => Math.min(...events.map(el => el.getBoundingClientRect().width)));
 const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
 observations.denseCalendar.axeViolations=scan.violations.map(({id,impact,nodes})=>({id,impact,count:nodes.length}));
 await page.screenshot({path:'docs/m06-reaudit-evidence/dense-desktop.png',fullPage:true});
 await page.goto('http://127.0.0.1:3100/?view=day&date=2027-01-12&resources=room-1');
 const event=page.getByRole('button',{name:/^Booking #337,/});
 await event.click();
 const other=await context.newPage();
 await other.goto('http://127.0.0.1:3100/');
 await other.evaluate(() => {
  const data=JSON.parse(localStorage.getItem('resourceBooking:v1:bookings'));
  const selected=data.items.find(b=>b.id===337);selected.status='cancelled';selected.cancelledAt=Date.now();
  localStorage.setItem('resourceBooking:v1:bookings',JSON.stringify(data));
 });
 await page.getByText('Cancelled',{exact:true}).waitFor();
 observations.externalDetail={status:await page.getByRole('dialog').innerText(),cancelActionCount:await page.getByRole('button',{name:'Cancel booking',exact:true}).count()};
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.evaluate(() => {
   const data=JSON.parse(localStorage.getItem('resourceBooking:v1:bookings'));
   data.items=data.items.map((booking,index)=>({...booking,
     startAt:index<7?Date.parse('2027-01-12T10:00:00Z'):booking.startAt,
     endAt:index<7?Date.parse('2027-01-12T11:00:00Z'):booking.endAt,
     status:index<7?'active':'cancelled',cancelledAt:index<7?null:1}));
   localStorage.setItem('resourceBooking:v1:bookings',JSON.stringify(data));
 });
 await page.goto('http://127.0.0.1:3100/?view=week&date=2027-01-12');
 await page.getByRole('button',{name:/^Booking #1,/}).waitFor();
 observations.typicalSharedWeek={eventCount:await page.locator('.fc-event[role="button"]').count(),minimumEventWidth:await page.locator('.fc-event[role="button"]').evaluateAll(events=>Math.min(...events.map(el=>el.getBoundingClientRect().width)))};
 await page.screenshot({path:'docs/m06-reaudit-evidence/shared-week-seven-events.png',fullPage:true});
 writeFileSync('docs/m06-reaudit-evidence/browser-results.json' ,JSON.stringify(observations,null,2));
 console.log(JSON.stringify(observations,null,2));
}finally{await context.close();await browser.close();}
