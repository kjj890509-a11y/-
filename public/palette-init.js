// Apply only a known presentation option. Financial data never enters the URL.
(()=>{
 const params=new URLSearchParams(location.search);
 const allowed=['graphite','navy','forest','clay','teal'];
 document.documentElement.dataset.palette=allowed.includes(params.get('palette'))?params.get('palette'):'graphite';
 if(params.get('compare')==='1')document.documentElement.dataset.compare='true';
})();
