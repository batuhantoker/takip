async function test() {
  try {
    let res = await fetch('https://autopistacentral.cl/camaras');
    let data = await res.text();
    console.log('Length:', data.length);
  } catch(e) {
    console.log('Error', e);
  }
}
test();
