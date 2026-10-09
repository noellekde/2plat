/* 2plat: builds a standalone HTML game from a project + the runtime source.
   Shared by the editor (Export game) and the command-line tool. */
(function (root) {
  'use strict';
  const BOOT = `(function(){
var P=JSON.parse(document.getElementById('pdata').textContent),S=P.settings,cv=document.getElementById('c');
var g=new Plat2.Game(cv,P,{});
function fit(){var s=Math.min(innerWidth/S.width,innerHeight/S.height);if(S.pixelArt!==false&&s>=1)s=Math.floor(s);cv.style.width=Math.floor(S.width*s)+'px';cv.style.height=Math.floor(S.height*s)+'px';}
addEventListener('resize',fit);fit();
if(S.pixelArt===false)cv.style.imageRendering='auto';
g.load().then(function(){g.start();});
if('ontouchstart' in window||navigator.maxTouchPoints>0){
 var td=P.objects.some(function(o){return o.behavior==='topdown';});
 function btn(label,key,style){var b=document.createElement('div');b.textContent=label;b.style.cssText='position:fixed;width:64px;height:64px;border-radius:50%;background:rgba(255,255,255,.18);color:#fff;font:700 22px sans-serif;display:flex;align-items:center;justify-content:center;user-select:none;touch-action:none;'+style;
  b.addEventListener('pointerdown',function(e){e.preventDefault();g.press(key);});['pointerup','pointercancel','pointerleave'].forEach(function(ev){b.addEventListener(ev,function(){g.release(key);});});document.body.appendChild(b);}
 btn('◀','left','left:14px;bottom:20px;');btn('▶','right','left:92px;bottom:20px;');
 if(td){btn('▲','up','left:53px;bottom:90px;');btn('▼','down','left:53px;bottom:-30px;');}
 btn('A','jump','right:14px;bottom:20px;');btn('B','action','right:92px;bottom:60px;');
}
})();`;

  function buildHtml(project, runtimeSource) {
    const data = JSON.stringify(project).replace(/</g, '\\u003c');
    const title = String((project.settings && project.settings.title) || project.name || 'Game').replace(/[<>&"]/g, '');
    return '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"><title>' + title + '</title>\n<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}body{display:flex;align-items:center;justify-content:center}canvas{image-rendering:pixelated;background:#000;touch-action:none}</style></head><body>\n<canvas id="c"></canvas>\n<script type="application/json" id="pdata">' + data + '</script>\n<script>' + runtimeSource.replace(/<\/script/gi, '<\\/script') + '</script>\n<script>' + BOOT + '</script>\n</body></html>';
  }
  root.Plat2Export = { buildHtml };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Plat2Export;
})(typeof window !== 'undefined' ? window : globalThis);
