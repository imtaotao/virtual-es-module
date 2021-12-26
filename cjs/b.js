const obj = require('./a.js')

exports.name = 'm2'

console.log(obj.name);
console.log(obj);

setTimeout(() => {
  console.log(obj.name);
})