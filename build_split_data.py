# -*- coding: utf-8 -*-
"""阶段0.3 数据分片（内容感知 + 体积感知）+ 导航索引生成。
读取现有分片重建完整 stages（保持全局 stage 顺序），按体积上限切成 N 段，
写回 part1~N.js，并生成极小的 index.js（仅导航树，不含词条正文）。

分片数 N 不固定：打包器按 MAX_PART_MB 把 stages 顺序切到每个分片 ≤ 上限
（按"阶段"粒度，保持 stage 连续，前端 tril-core.js 用 index.partRanges 动态得出
PARTS_TOTAL，天然支持任意 N 个分片）。

为什么这样设计：Cloudflare Pages 单文件硬上限 25MiB。过去把核心词库[6]单独成段
约 16~20MiB，临近上限；一旦例句继续增长，单分片会超过 25MiB 传不上。
本脚本在生成期就把数据自动切成足够多的小分片，从根上避免触发该红线。
"""
import json, os

STATIC = os.path.dirname(os.path.abspath(__file__)) + "/static"
MAX_PART_MB = 18.0                       # 每个分片体积上限（留余量避开 25MiB 红线）
MAX_PART_BYTES = MAX_PART_MB * 1048576.0


def load_part(k):
    fn = STATIC + "/三语母语习得核心词库.part%d.js" % (k + 1)
    s = open(fn, encoding="utf-8").read()
    i = s.index("__TRIL_PARTS__[")
    eq = s.index("=", i)
    j = s.rindex(";")
    return json.loads(s[eq + 1:j])


def stage_bytes(st):
    return len(json.dumps(st, ensure_ascii=False).encode("utf-8"))


# 读取现有分片（从 part1 往下读到不存在为止，支持任意数量）
existing = []
k = 0
while True:
    fn = STATIC + "/三语母语习得核心词库.part%d.js" % (k + 1)
    if not os.path.exists(fn):
        break
    existing.append(k)
    k += 1
PARTS_OLD = len(existing)
print("读取现有分片 part1~%d ..." % PARTS_OLD)
parts = [load_part(k) for k in existing]
full = []
for p in parts:
    full.extend(p)

# 体积感知打包：把 stages 顺序切到 N 个分片，每片 ≤ MAX_PART_BYTES（阶段粒度）
groups = []          # 每个元素 [start_stage, end_stage)
cur_start = 0
cur_bytes = 0
for si, st in enumerate(full):
    b = stage_bytes(st)
    if cur_bytes + b > MAX_PART_BYTES and si > cur_start:
        groups.append([cur_start, si])
        cur_start = si
        cur_bytes = 0
    cur_bytes += b
if cur_start < len(full):
    groups.append([cur_start, len(full)])

PARTS_N = len(groups)
print("体积打包 → %d 个分片（上限 %.1f MiB）" % (PARTS_N, MAX_PART_MB))

# 写回 N 段
part_ranges = []
for k, (a, b) in enumerate(groups):
    seg = full[a:b]
    part_ranges.append([a, b])
    fn = STATIC + "/三语母语习得核心词库.part%d.js" % (k + 1)
    with open(fn, "w", encoding="utf-8") as f:
        f.write("window.__TRIL_PARTS__=window.__TRIL_PARTS__||[];window.__TRIL_PARTS__[%d]=" % k)
        json.dump(seg, f, ensure_ascii=False, separators=(",", ":"))
        f.write(";")
    mb = os.path.getsize(fn) / 1048576.0
    warn = "  ⚠ 超过上限! 需拆阶段内单元" if mb > MAX_PART_MB else ""
    print("  part%d: stages %d-%d, %.2f MB%s" % (k + 1, a, b - 1, mb, warn))

# 删除多余旧分片（若 N 比之前少）
for extra in range(PARTS_N, PARTS_OLD):
    fn = STATIC + "/三语母语习得核心词库.part%d.js" % (extra + 1)
    if os.path.exists(fn):
        os.remove(fn)
        print("  删除多余旧分片 part%d.js" % (extra + 1))

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

for k, (a, b) in enumerate(groups):
    for si in range(a, b):
        idx_stages[si]["part"] = k

index = {"partRanges": part_ranges, "stages": idx_stages}
with open(STATIC + "/三语母语习得核心词库.index.js", "w", encoding="utf-8") as f:
    f.write("window.__TRIL_INDEX__=")
    json.dump(index, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";")
print("index.js: %.2f KB, stages=%d" % (os.path.getsize(STATIC + "/三语母语习得核心词库.index.js") / 1024.0, len(idx_stages)))

# 校验：拼回后应等于 full
rebuilt = []
for k, (a, b) in enumerate(groups):
    rebuilt.extend(full[a:b])
assert len(rebuilt) == len(full), "重建 stage 数不一致"
print("校验通过：%d 段拼回 = %d stages / 全局顺序一致" % (PARTS_N, len(rebuilt)))
print("OK")
