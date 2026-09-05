# -*- coding: utf-8 -*-
"""
阶段0.1 词库合并构建脚本
将 3 份结构相同、字段布局不同的 .data.js 合并为 1 份「并集字段」文件：
  - 学习器: window.__LEARNER_DATA__  (有 level，无 zh_pinyin)
  - 测试器: window.__TESTER_DATA__    (有 level + zh_pinyin)
  - 播放器: window.__PLAYER_DATA__     (无 level，无 zh_pinyin)
合并产物: window.__TRIL_DATA__ = 并集字段的同一棵树
策略: 锁步（结构上三份 1:1 对应）合并，entry 级做字段并集。
"""
import json, os, sys

STATIC = os.path.dirname(os.path.abspath(__file__)) + "/static"
LEARNER = STATIC + "/三语母语习得学习器.data.js"
TESTER  = STATIC + "/三语母语习得测试器.data.js"
PLAYER  = STATIC + "/三语母语习得快速播放器.data.js"
OUT     = STATIC + "/三语母语习得核心词库.data.js"

def load(f):
    s = open(f, encoding="utf-8").read()
    return json.loads(s[s.index("{"):s.rindex("}") + 1])

def merge_node(base, others):
    if isinstance(base, list):
        for o in others:
            if len(o) != len(base):
                raise ValueError("list length mismatch: %d vs %d" % (len(base), len(o)))
        for idx in range(len(base)):
            merge_node(base[idx], [o[idx] for o in others])
    elif isinstance(base, dict):
        if "en" in base:  # 词条级：并集字段
            for o in others:
                for k, v in o.items():
                    if k not in base:
                        base[k] = v
        else:
            for k, v in list(base.items()):
                if isinstance(v, (list, dict)):
                    merge_node(v, [o.get(k, v) for o in others])

def count_entries(tree):
    n = 0
    def walk(x):
        nonlocal n
        if isinstance(x, list):
            for i in x: walk(i)
        elif isinstance(x, dict):
            if "en" in x: n += 1
            else:
                for v in x.values(): walk(v)
    walk(tree)
    return n

print("loading learner ...")
base = load(LEARNER)
n_base = count_entries(base)
print("  learner entries:", n_base)

print("merging tester (adds zh_pinyin) ...")
t = load(TESTER)
merge_node(base, [t]); del t
n_with_py = sum(1 for _ in [])  # placeholder

print("merging player (subset, adds nothing new) ...")
p = load(PLAYER)
merge_node(base, [p]); del p

# 统计合并后 zh_pinyin 覆盖
cnt_zh = 0; cnt_level = 0; total = 0
def walk_stat(x):
    global cnt_zh, cnt_level, total
    if isinstance(x, list):
        for i in x: walk_stat(i)
    elif isinstance(x, dict):
        if "en" in x:
            total += 1
            if x.get("zh_pinyin"): cnt_zh += 1
            if x.get("level") is not None: cnt_level += 1
        else:
            for v in x.values(): walk_stat(v)
walk_stat(base)
print("merged entries:", total, "with zh_pinyin:", cnt_zh, "with level:", cnt_level)

print("writing merged file (ensure_ascii=False) ...")
with open(OUT, "w", encoding="utf-8") as f:
    f.write("window.__TRIL_DATA__ = ")
    json.dump(base, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";")
print("done ->", OUT, os.path.getsize(OUT), "bytes")
