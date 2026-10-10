const hiddenModules=new Set(['rec','backtest']);
export const readerModules=modules=>(modules||[]).filter(m=>!hiddenModules.has(m.id)).map(m=>m.id==='action'?{...m,title:'HÀNH ĐỘNG'}:m);

export function actionParagraph(modules,analysis){
 const get=id=>{const m=modules?.find(m=>m.id===id);return m?.status==='computed'?m.result||{}:{};};
 const flow=get('flow'),trend=get('trend'),relative=get('alpha').cross_sectional||{},costs=get('costs'),levels=get('sr');
 const finite=value=>typeof value==='number'&&Number.isFinite(value);
 const number=value=>value.toLocaleString('vi-VN',{maximumFractionDigits:2});
 const observations=[];
 if(finite(trend.er)&&trend.er<=.3)observations.push('xu hướng còn nhiễu');
 if(finite(flow.cmf))observations.push(flow.cmf<0?'áp lực bán đang chiếm ưu thế':flow.cmf>0?'dòng tiền giá–khối lượng đang ủng hộ':'CMF bằng 0 chưa xác nhận được hướng dòng tiền');
 if(finite(relative.rs_20d_pct)&&relative.rs_20d_pct<0)observations.push('giá yếu hơn VN-Index');
 let conclusion=observations.length?`${observations.join(', ')}.`:'Bằng chứng hiện tại chưa đủ để xác nhận một quyết định mua.';
 conclusion=conclusion[0].toUpperCase()+conclusion.slice(1);
 const confirmed=analysis?.headline==='Đủ điều kiện mua theo quy tắc hệ thống';
 if(finite(costs.net_forecast_pct))conclusion+=` Dự báo sau chi phí ${costs.net_forecast_pct>0?'+':''}${number(costs.net_forecast_pct)}% ${confirmed?'thuộc kịch bản đã được hệ thống xác nhận':'cần thêm xác nhận'}.`;
 const blocked=analysis?.headline==='Tránh mở vị thế mới theo kết quả hiện tại';
 const before=confirmed?'cân nhắc giải ngân từng phần theo mức vào và ngân sách rủi ro đã xác nhận':blocked?'tạm tránh mở vị thế mới và chờ các điều kiện bị chặn được cải thiện':'tiếp tục quan sát, chờ xu hướng và dòng tiền cùng xác nhận trước khi giải ngân';
 const weak=(finite(flow.cmf)&&flow.cmf<0)||(finite(relative.rs_20d_pct)&&relative.rs_20d_pct<0)||(finite(costs.net_forecast_pct)&&costs.net_forecast_pct<=0)||blocked;
 const support=levels.supports?.find(s=>finite(s.price)&&s.price>0)?.price;
 const held=weak?'giữ tỷ trọng thận trọng, chưa mua thêm':'theo dõi vị thế hiện tại và chưa tự tăng tỷ trọng khi thiếu xác nhận';
 const risk=finite(support)?`cân nhắc giảm tỷ trọng nếu giá mất vùng hỗ trợ tham chiếu ${number(support)} ₫ và tuân thủ mức dừng lỗ đã đặt`:'bám mức dừng lỗ trong kế hoạch cá nhân và đánh giá lại khi xu hướng hoặc dòng tiền xấu đi';
 const sample=modules?.some(m=>m.reading?.includes('[DỮ LIỆU MẪU]'))?'[DỮ LIỆU MẪU] ':'';
 return `${sample}${conclusion} Nếu chưa mua, nên ${before}. Nếu đang cầm hàng, nên ${held}; ${risk}.`;
}

export function readerSynthesis(analysis,modules){
 if(!analysis)return analysis;
 return {...analysis,covered_module_ids:analysis.covered_module_ids?.filter(id=>!hiddenModules.has(id)),
  sections:analysis.sections?.map(section=>{
   if(!section.module_ids?.some(id=>hiddenModules.has(id)||id==='action'))return section;
   const pairs=section.module_ids.map((id,index)=>({id,text:section.paragraphs?.[index]})).filter(p=>!hiddenModules.has(p.id));
   return {...section,module_ids:pairs.map(p=>p.id),paragraphs:[...pairs.map(p=>p.id==='action'?`HÀNH ĐỘNG: ${actionParagraph(modules,analysis)}`:p.text).filter(Boolean),'Mốc giá và quy mô vị thế là kế hoạch có điều kiện; cần đối chiếu tín hiệu, chi phí và khả năng thực thi trước khi áp dụng.']};
  }),limitations:analysis.limitations?.filter(text=>!/Backtest|Điểm Quant/i.test(text))};
}
