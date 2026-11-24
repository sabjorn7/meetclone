// Only the two existing club history lists. Keep the bottom anchored during async layout.
const ids = new Set(['64185e3b-d0b8-4df2-ba17-4ee099c1b359','160326aa-6464-4cb5-8e2c-1bf81223e023']);
const cleanup = new WeakMap();
export const clubChatScroll = {
 mounted(el,{value}) {
  if(!ids.has(value)||!el?.addEventListener)return;
  let pinned=true,frame=0;
  const bottom=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(pinned&&el.clientHeight)el.scrollTop=el.scrollHeight})};
  const intent=()=>{pinned=false};
  const scroll=()=>{if(el.scrollHeight-el.clientHeight-el.scrollTop<4)pinned=true};
  const resize=new ResizeObserver(bottom);
  const observe=()=>{resize.disconnect();resize.observe(el);for(const child of el.children)resize.observe(child);bottom()};
  const mutation=new MutationObserver(observe);mutation.observe(el,{childList:true,subtree:true});observe();
  for(const event of ['wheel','touchstart','pointerdown','keydown'])el.addEventListener(event,intent,{passive:true});
  el.addEventListener('scroll',scroll,{passive:true});
  cleanup.set(el,()=>{cancelAnimationFrame(frame);resize.disconnect();mutation.disconnect();el.removeEventListener('scroll',scroll);for(const event of ['wheel','touchstart','pointerdown','keydown'])el.removeEventListener(event,intent)});
 },
 unmounted(el){cleanup.get(el)?.();cleanup.delete(el)}
};
