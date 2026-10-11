export const moduleStatusLabels={computed:'Đã tính',missing:'Chưa có dữ liệu',unavailable:'Không khả dụng',disabled:'Đã tắt',fallback:'Phương pháp thay thế',warmup:'Chưa đủ mẫu',partial:'Kết quả một phần'};
export function flattenResult(value,prefix='',out=[]) {
  if(value&&typeof value==='object'){
    for(const [key,item] of Object.entries(value))flattenResult(item,prefix?`${prefix}.${key}`:key,out);
  } else out.push({key:prefix,value});
  return out;
}
export const displayResult=value=>value==null?'Chưa có':typeof value==='number'?Number.isFinite(value)?value.toLocaleString('vi-VN',{maximumFractionDigits:6}):'Chưa có':typeof value==='boolean'?value?'Có':'Không':String(value);
