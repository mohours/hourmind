-- server/db/seed.sql
-- 预置 7 家 AI 厂商数据（INSERT OR IGNORE 保证幂等，重复执行不报错）

INSERT OR IGNORE INTO provider (id, name, slug, base_url, is_active) VALUES
  ('p1', 'OpenAI',       'openai',     'https://api.openai.com/v1',                              1),
  ('p2', 'Anthropic',    'anthropic',  'https://api.anthropic.com',                              1),
  ('p3', 'DeepSeek',     'deepseek',   'https://api.deepseek.com/v1',                            1),
  ('p4', 'Google Gemini','gemini',     'https://generativelanguage.googleapis.com/v1beta',        1),
  ('p5', 'xAI Grok',     'grok',       'https://api.x.ai/v1',                                    1),
  ('p6', 'Moonshot',     'moonshot',   'https://api.moonshot.cn/v1',                             1),
  ('p7', '通义千问',     'qwen',       'https://dashscope.aliyuncs.com/compatible-mode/v1',      1);
