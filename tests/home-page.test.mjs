import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const server=await createServer({server:{middlewareMode:true,hmr:false},appType:'custom'});
after(()=>server.close());
const {default:HomePage,Explanation}=await server.ssrLoadModule('/src/components/HomePage.jsx');
test('home renders the complete inspection journey and model explorer without invoking analysis',()=>{
 const html=renderToStaticMarkup(createElement(HomePage,{onNavigate(){throw Error('navigation during render');},onInspect(){throw Error('analysis during render');}}));
 for(const text of ['kiểm định một cổ phiếu trước khi bỏ tiền','Nghe một mã','Kiểm định','Hiểu bằng chứng','Lập kế hoạch','Tự quyết định'])assert(html.includes(text));
 assert.equal((html.match(/<canvas /g)||[]).length,8);
 assert.equal((html.match(/class="home-model-card /g)||[]).length,7);
 for(const text of ['MINH HỌA CƠ CHẾ','COMING SOON','Mã cổ phiếu cần kiểm định','Tạm dừng mô phỏng'])assert(html.includes(text));
});
test('model explanations distinguish conditional variance, regime probability and unavailable option IV',()=>{
 const render=id=>renderToStaticMarkup(createElement(Explanation,{selection:id,onClose(){},paused:true}));
 const garch=render('garch'),hmm=render('hmm'),iv=render('iv');
 assert(garch.includes('không phải implied volatility surface'));
 assert(hmm.includes('không phải xác suất một lệnh giao dịch thắng'));
 assert(iv.includes('Coming soon · chưa khả dụng'));
 assert(iv.includes('Chưa khả dụng trong kiến trúc cổ phiếu hiện tại'));
 for(const html of [garch,hmm,iv])for(const text of ['Đầu vào','Đầu ra thể hiện điều gì','Giới hạn áp dụng','Không phải kết quả phân tích'])assert(html.includes(text));
});
