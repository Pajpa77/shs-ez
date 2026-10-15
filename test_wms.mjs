const res = await fetch('https://uas-betrieb.de/geoservices/dipul/wms?service=WMS&request=GetCapabilities'); console.log(res.status); process.exit(0);
