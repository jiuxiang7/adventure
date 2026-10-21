# ADVENTURE

一个纯前端横屏弹幕小游戏。使用 Canvas 2D、原生 JavaScript 与文件夹中的本地素材制作，无需安装依赖。

## 目录

```text
adventure/
├─ index.html
├─ README.md
├─ preview.jpg
├─ assets/
│  ├─ audio/     # fight1 / fight2 / victory1
│  └─ images/    # 原始素材 + opt/ 下的运行时压缩图
└─ src/
   ├─ game.js
   └─ style.css
```

## 运行

直接双击 `index.html` 即可游玩。

如果浏览器对本地音频有限制，可在本目录启动一个静态服务器：

```powershell
python -m http.server 8000
```

然后打开 `http://localhost:8000/`。

## 操作

| 按键 | 动作 |
| --- | --- |
| `W` | 向上飞行（松开后受重力影响下坠） |
| `A` / `D` | 向左 / 向右移动 |
| `S` | 加速向下俯冲 |
| `SPACE` | 发射玩家子弹（按住连发） |
| `R` / `ENTER` | 失败或通关后返回初始界面 / 重新开始 |

出生点位于初始地图左侧。阅读地图内的全息按键说明后，一直向右移动到边界即可进入关卡。

## 流程

1. **STAGE 01 · 天台球场**：Boss 1 从右侧入场，播放 `fight1`。击败后播放 `victory1`，Boss 化为公鸡并向右侧离场。
2. **STAGE 02 · 校园异变**：玩家从左侧进入 `background2`，面向左侧的公鸡站在右侧，随后变成 Boss 2，开始发射蛋形弹幕。
3. **FINAL STAGE · 笑声回廊**：Boss 2 被击败后在同一地图中变成 Boss 3，`fight2` 循环播放，弹幕升级为旋转校徽螺旋。
4. 左上角显示玩家生命值。中弹会扣血并获得短暂无敌时间；生命归零后可以点击按钮或按 `R` 回到初始界面。

三个 Boss 都拥有各自的移动轨迹与弹幕组合。小心弹幕，祝旅途顺利。
