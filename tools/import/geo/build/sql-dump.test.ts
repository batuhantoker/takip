import { describe, expect, it } from 'vitest';
import { SqlDumpParser } from './sql-dump';

const DUMP = [
  '-- MySQL dump',
  'CREATE TABLE `geo_tags` (',
  '  `gt_id` int(10) unsigned NOT NULL AUTO_INCREMENT,',
  '  `gt_page_id` int(10) unsigned NOT NULL,',
  '  `gt_name` varbinary(255) DEFAULT NULL,',
  '  `gt_lat` decimal(11,8) DEFAULT NULL,',
  '  PRIMARY KEY (`gt_id`),',
  '  KEY `gt_page_id_id` (`gt_page_id`,`gt_id`)',
  ') ENGINE=InnoDB;',
  'INSERT INTO `geo_tags` VALUES',
  "(1,10,'Kostanjevica na Krki',45.84),",
  "(2,11,'it\\'s, (odd)',-1.5e-3),",
  "(3,12,NULL,NULL);",
  "INSERT INTO `geo_tags` VALUES (4,13,'a\\\\b\\nc',0),(5,14,'',7);",
  '/*!40000 ALTER TABLE `geo_tags` ENABLE KEYS */;',
  '',
].join('\n');

const ROWS = [
  [1, 10, 'Kostanjevica na Krki', 45.84],
  [2, 11, "it's, (odd)", -0.0015],
  [3, 12, null, null],
  [4, 13, 'a\\b\nc', 0],
  [5, 14, '', 7],
];

describe('SqlDumpParser', () => {
  it('reads columns and tuples, old one-line and new one-per-line inserts alike', () => {
    const p = new SqlDumpParser();
    expect(p.push(DUMP)).toEqual(ROWS);
    expect(p.columns).toEqual(['gt_id', 'gt_page_id', 'gt_name', 'gt_lat']);
  });

  it('gives the same rows however the text is chunked', () => {
    for (const size of [1, 2, 3, 7, 13, 64]) {
      const p = new SqlDumpParser();
      const rows = [];
      for (let i = 0; i < DUMP.length; i += size) rows.push(...p.push(DUMP.slice(i, i + size)));
      expect(rows, `chunk ${size}`).toEqual(ROWS);
    }
  });
});
