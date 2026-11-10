import assert from 'node:assert/strict';
import {categories} from '../src/overview/taxonomy.ts';

const ids=new Set();
let metrics=0;
function unique(item){
  assert(item.id && !ids.has(item.id),'Duplicate or missing taxonomy ID: '+item.id);
  ids.add(item.id);
  assert(item.title?.trim(),'Missing title: '+item.id);
}
assert(categories.length>=5 && categories.length<=8);
for(const category of categories){
  unique(category);
  assert(category.question && /^#[0-9a-f]{6}$/i.test(category.color));
  assert(category.groups.length>=2);
  for(const group of category.groups){
    unique(group);
    assert(group.question && group.metrics.length>=2);
    for(const metric of group.metrics){
      unique(metric);
      assert(metric.definition && metric.source && metric.caveat,'Incomplete metric: '+metric.id);
      assert.equal(new URL(metric.url).protocol,'https:');
      assert(!('value' in metric),'The structure preview must not imply measured values');
      metrics++;
    }
  }
}
console.log(`${categories.length} categories and ${metrics} metric definitions have unique paths, source references and limitations; no fabricated values.`);
