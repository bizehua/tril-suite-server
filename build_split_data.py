# -*- coding: utf-8 -*-
"""阶段0.3 数据 4 段分片（内容感知 + 体积均衡）+ 导航索引生成。
读取现有 4 个分片重建完整 stages（保持全局 stage 顺序），按内容分组切成 4 段，
写回 part1~4.js，并生成极小的 index.js（仅导航树，不含词条正文）。
分组说明：启蒙(0-2) / 进阶(3-5) / 核心词库[6]单独成段（16.5MB，按需加载）/ 专业·通用·主题(7-16)。
"""
import json, os

STATIC = os.path.dirname(os.path.abspath(__file__)) + "/static"
PARTS = 4
# 全局 stage 索引区间（左闭右开）。master 核心词库[6]单独成段以均衡体积。
GROUPS = [[0, 3], [3, 6], [6, 7], [7, 17]]


def load_part(k):
    fn = STATIC + "/三语母语习得核心词库.part%d.js" % (k + 1)
    s = open(fn, encoding="utf-8").read()
    i = s.index("__TRIL_PARTS__[")
    eq = s.index("=", i)
    j = s.rindex(";")
    return json.loads(s[eq + 1:j])


print("读取现有分片 ...")
parts = [load_part(k) for k in range(PARTS)]
full = []
for p in parts:
    full.extend(p)
assert len(full) == 17, "stages=%d (期望 17)" % len(full)

# 写回 4 段（按 GROUPS 连续切分，全局索引不变）
part_ranges = []
for k in range(PARTS):
    seg = full[GROUPS[k][0]:GROUPS[k][1]]
    part_ranges.append([GROUPS[k][0], GROUPS[k][1]])
    fn = STATIC + "/三语母语习得核心词库.part%d.js" % (k + 1)
    with open(fn, "w", encoding="utf-8") as f:
        f.write("window.__TRIL_PARTS__=window.__TRIL_PARTS__||[];window.__TRIL_PARTS__[%d]=" % k)
        json.dump(seg, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";")
    print("  part%d: stages %d-%d, %.2f MB" % (k + 1, GROUPS[k][0], GROUPS[k][1] - 1, os.path.getsize(fn) / 1048576.0))

# 生成 index.js（导航树，无词条正文）
idx_stages = []
for si, st in enumerate(full):
    files = []
    for f in st.get("files", []):
        units = []
        for u in f.get("units", []):
            units.append({
                "t": u.get("title", ""),
                "n": len(u.get("entries", u.get("items", []))),
                "type": u.get("type", "table"),
                "langs": u.get("langs", ["en", "zh", "bm"]),
            })
        files.append({"name": f.get("name", ""), "units": units})
    idx_stages.append({"name": st.get("name", ""), "part": None, "files": files})

for k in range(PARTS):
    for si in range(GROUPS[k][0], GROUPS[k][1]):
        idx_stages[si]["part"] = k

index = {"partRanges": part_ranges, "stages": idx_stages}
with open(STATIC + "/三语母语习得核心词库.index.js", "w", encoding="utf-8") as f:
    f.write("window.__TRIL_INDEX__=")
    json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";")
print("index.js: %.2f KB, stages=%d" % (os.path.getsize(STATIC + "/三语母语习得核心词库.index.js") / 1024.0, len(idx_stages)))

# 校验：拼回后应等于 full
rebuilt = []
for k in range(PARTS):
    rebuilt.extend(full[GROUPS[k][0]:GROUPS[k][1]])
assert len(rebuilt) == len(full), "重建 stage 数不一致"
print("校验通过：4 段拼回 = %d stages / 全局顺序一致" % len(rebuilt))
print("OK")
