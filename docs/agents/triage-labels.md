# Triage labels

`triage` スキルは未導入なので、5 つの状態ロールを運用するラベル体系は持たない。
ただし `to-tickets` が発行時に `ready-for-agent` を付けるため、このラベルだけを作成済み。

`to-tickets` が切るチケットは構造上すべて agent が着手できる状態なので、このラベルは実質「`to-tickets` 由来」の目印として働く。

`triage` を後から導入する場合は、残る 4 つ（`needs-triage`, `needs-info`, `ready-for-human`, `wontfix`）を同じ名前で作り、この表を canonical role → label string のマッピングとして埋める。`wontfix` は GitHub の既定ラベルとして既に存在する。

| Canonical role | Label string | 状態 |
|---|---|---|
| `ready-for-agent` | `ready-for-agent` | 作成済み |
| `needs-triage` | — | `triage` 導入時 |
| `needs-info` | — | `triage` 導入時 |
| `ready-for-human` | — | `triage` 導入時 |
| `wontfix` | `wontfix` | 既定ラベルとして存在 |
