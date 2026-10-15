const res = await fetch('https://uas-betrieb.de/geoservices/dipul/wfs?service=WFS&request=GetCapabilities'); const text = await res.text(); console.log(text.substring(0, 500)); process.exit(0);
