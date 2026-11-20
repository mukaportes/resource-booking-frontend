import { chromium } from '/Users/muriloportescheller/Documents/dev-work/interview/alvorada/resource-booking-frontend/node_modules/playwright-core/index.mjs';
const browser = await chromium.launch({headless:true});
async function workspace(timezoneId='UTC',query='?view=day&date=2027-01-12&resources=room-1') {
 const context=await browser.newContext({timezoneId,viewport:{width:1440,height:1000}});
 const page=await context.newPage();
 await page.clock.setFixedTime(new Date('2027-01-11T08:00:00Z'));
 await page.goto('http://127.0.0.1:3100/'+query);
 await page.getByLabel('Work email').fill('audit@example.com');
 await page.getByRole('button',{name:'Open workspace'}).click();
 await page.getByRole('button',{name:'＋ New booking'}).waitFor();
 return {context,page};
}
async function fill(page,date,start,end){
 await page.getByRole('button',{name:'＋ New booking'}).click();
 await page.getByLabel('Start date').fill(date);
 await page.getByLabel('End date').fill(date);
 await page.getByLabel('Start time').fill(start);
 await page.getByLabel('End time').fill(end);
 await page.getByText('✓ Available',{exact:true}).waitFor();
}
try {
 const {context,page}=await workspace('America/New_York','?view=day&date=2027-03-14&resources=room-1');
 await page.getByRole('button',{name:'＋ New booking'}).click();
 console.log('NEW_BOOKING_DATE',await page.getByLabel('Start date').inputValue(),'visible schedule date=2027-03-14');
 await page.getByLabel('Start date').fill('2027-03-14');
 await page.getByLabel('End date').fill('2027-03-14');
 await page.getByLabel('Start time').fill('02:00');
 await page.getByLabel('End time').fill('02:30');
 await page.getByText('✓ Available',{exact:true}).waitFor();
 console.log('DST_FORM',await page.getByLabel('Start time').inputValue(),await page.getByLabel('End time').inputValue());
 await page.getByRole('button',{name:'Book',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 console.log('DST_STORED',await page.evaluate(()=>JSON.parse(localStorage.getItem('resourceBooking:v1:bookings')).items.map(b=>({start:new Date(b.startAt).toString(),end:new Date(b.endAt).toString()}))));
 await page.screenshot({path:'/private/tmp/booking-audit-desktop.png',fullPage:true});
 await context.close();
 const second=await workspace();
 await fill(second.page,'2027-01-12','10:00','11:00');
 const other=await second.context.newPage();
 await other.goto('http://127.0.0.1:3100/');
 await other.evaluate(()=>{
  const user=JSON.parse(localStorage.getItem('resourceBooking:v1:users')).items[0];
  localStorage.setItem('resourceBooking:v1:bookings',JSON.stringify({schemaVersion:1,items:[{id:1,resourceId:'room-1',userId:user.userId,startAt:Date.parse('2027-01-12T10:00:00Z'),endAt:Date.parse('2027-01-12T11:00:00Z'),status:'active',createdAt:Date.now(),cancelledAt:null}]}));
  localStorage.setItem('resourceBooking:v1:bookingSequence',JSON.stringify({schemaVersion:1,lastIssuedId:1}));
 });
 await second.page.getByText('Bookings were updated in another tab').first().waitFor();
 await second.page.waitForTimeout(500);
 console.log('EXTERNAL_CONFLICT_ADVISORY',await second.page.locator('.availability').innerText());
 await second.page.getByRole('button',{name:'Book',exact:true}).click();
 console.log('COMMIT_CONFLICT',await second.page.locator('.conflict-list').innerText());
 await second.context.close();
 const third=await workspace();
 await fill(third.page,'2027-01-12','10:00','11:00');
 await third.page.getByRole('button',{name:'Book',exact:true}).click();
 await third.page.getByRole('dialog').waitFor({state:'hidden'});
 await third.page.addInitScript(()=>sessionStorage.setItem('resourceBooking:v1:session','{broken'));
 await third.page.reload();
 await third.page.getByText('Your saved data needs attention',{exact:true}).waitFor();
 console.log('SESSION_CORRUPTION',await third.page.getByRole('dialog').innerText());
 await third.context.close();
 const fourth=await workspace();
 await fourth.page.addInitScript(()=>{
  const original=Storage.prototype.setItem;
  Storage.prototype.setItem=function(key,value){if(key.startsWith('resourceBooking:probe:')) throw new DOMException('Quota full','QuotaExceededError'); return original.call(this,key,value);};
 });
 await fourth.page.reload();
 await fourth.page.getByText('The workspace can’t access its data',{exact:true}).waitFor();
 console.log('FULL_STORAGE',await fourth.page.getByRole('dialog').innerText());
 await fourth.context.close();
} finally {await browser.close();}
