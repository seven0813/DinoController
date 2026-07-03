<!-- ABOUT THE PROJECT -->
## 项目介绍
这是一个人际交互小游戏，你可以通过人体运动控制小恐龙躲避障碍物，休息/久坐时可以玩一玩，放松身心。

<!-- 使用markdown的video标签来插入视频 -->
<div align="center">
<img src="src/demo1.gif" width="600" ></img>
</div>
<div align="center">
<img src="src/demo2.gif" width="600" ></img>
</div>


## 两种游玩方式

DinoController 现在支持两种本地游玩方式：

- **Web 版**：打开一个本地网页，直接在浏览器中游玩。
- **Python 版**：运行原始 Pygame 游戏窗口，再用 Python 控制脚本识别动作。

## Web 版

Web 版是推荐的本地演示方式。游戏、摄像头预览和动作识别都在一个网页里完成，动作识别使用浏览器端的 MediaPipe。

1. 克隆项目
```bash
git clone https://github.com/qqizhao/DinoController
cd DinoController
```

2. 启动本地 Web 服务
```bash
python web_server.py
```

3. 打开终端中打印的地址
```text
http://127.0.0.1:8000/web/
```

如果 `8000` 端口被占用，请使用终端里实际打印出来的地址。

基础操作：

- `Space` / `ArrowUp`：跳跃
- `ArrowDown`：下蹲
- 点击 / 触摸游戏画面：跳跃
- `R`：重新开始
- `C`：打开 / 关闭 MediaPipe 摄像头动作识别
- `S`：打开 / 关闭声音

摄像头模式：

- `MediaPipe`：张嘴或身体跳起会触发跳跃；下蹲会触发恐龙下蹲。
- `Mouth`：只识别张嘴跳跃。
- `Body`：识别身体跳跃和下蹲。
- `Keyboard`：忽略摄像头识别，只使用键盘和点击控制。

最高分会通过 `localStorage` 保存在当前浏览器中，不需要排行榜或后端数据库。

## Python 版

Python 版是原始 Pygame 实现。它会打开一个游戏窗口，然后通过单独的 Python 控制脚本识别张嘴或跳跃动作，并模拟键盘输入来控制小恐龙。

1. 安装 Python 依赖
```bash
pip install -r requirement.txt
```

2. 启动游戏
```bash
cd Dino-game  
python Game.py
```

3. 打开一个新终端，启动控制脚本
```bash
# 如果想用张嘴控制游戏
python mouthCon.py  
# 如果想用身体跳跃控制游戏
python jumpCon.py
```
> **注意：启动控制脚本前，请先点击游戏窗口，让游戏窗口获得焦点。**



<!-- ACKNOWLEDGMENTS -->
## 致谢

* [Dino-Rush](https://github.com/SlenderData/Dino-Rush)
