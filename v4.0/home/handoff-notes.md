# 交接文档：主页组件位置与登录状态隔离

## 当前需求背景

用户发现主页左侧菜单的“设置 -> 调整组件位置”存在状态串用问题：

- 未登录状态下调整并保存组件位置后，点击“游客登录”，这个调整会进入游客状态。
- 游客登录状态下调整并保存后，退出游客再登录邮箱账号，游客布局又会进入邮箱账号。
- 期望三种状态完全隔离：
  - 未登录：不能点击设置，也不能调整组件位置。
  - 游客登录：组件位置只保存在游客状态下，不回到未登录状态，也不带到邮箱账号。
  - 邮箱账号登录：组件位置只保存在自己的账号下，不被游客影响，也不影响游客和未登录。

## 已修改文件

- `D:\First\Personal-Portal-Project\v3.0\home\script.js`
- `D:\First\Personal-Portal-Project\v3.0\home\style.css`

## 已完成的修复

### 1. 未登录不能使用设置

在 `script.js` 中增加了 `syncSettingsAccess()`：

- 根据 `currentUser` 判断设置按钮是否可用。
- 未登录时设置按钮标记为 `aria-disabled="true"`。
- 未登录时强制关闭设置菜单。

点击设置按钮时增加了守卫：

- 如果未登录，不打开菜单。
- 打开账号面板。
- 提示“登录后可使用设置”。

### 2. 未登录不能直接拖动或编辑组件

在气泡组件的拖动、缩放、双击编辑入口增加了 `currentUser` 判断：

- 未登录时阻止拖动。
- 未登录时阻止缩放。
- 未登录时阻止双击编辑。
- 会打开账号面板并提示登录。

### 3. 组件位置按身份独立保存

新增 `readUserValue(key)`：

- 只有当前存在登录身份时才读取 `user:${currentUser.id}:${key}`。
- 不再从全局 `localStorage` 的旧键回退读取组件布局。

`applySavedBubbles()` 改为：

- 只读取当前身份自己的 `bubbles`。
- 如果当前身份没有保存布局，则恢复默认布局。
- 如果保存数据损坏，也恢复默认布局并清理损坏数据。

### 4. 切换身份时不沿用上一个身份画面上的 DOM

新增：

- `defaultBubbleState`
- `applyBubbles(bubbles)`
- `applyDefaultBubbles()`

现在切换到游客或邮箱账号时：

- 先按当前身份读取自己的布局。
- 当前身份没有布局时，恢复页面初始默认布局。
- 不会继续沿用上一个身份已经拖动过的 DOM 状态。

退出登录后：

- `applyLoggedOutProfile()` 会恢复默认头像、默认用户名/签名，并恢复默认气泡布局。

### 5. 设置菜单中的保存入口补齐

给 `settingsMenu` 增加了对 `data-global-action` 的处理：

- `reorder`：显示“保存顺序”按钮，并提示拖动后保存。
- `save-order`：调用 `saveBubbles()`，只保存当前身份自己的布局，然后关闭菜单。
- 未登录时点击相关操作会被阻止。

### 6. 未登录设置按钮的样式

在 `style.css` 中增加：

- `.settings[aria-disabled="true"]`
- `.settings[aria-disabled="true"]:hover`
- `body.logged-out .sidebar .settings`

未登录时设置按钮会显示为不可用状态。

## 验证情况

已使用 Codex 自带 Node 环境执行脚本语法检查：

```powershell
& 'C:\Users\24271\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check 'D:\First\Personal-Portal-Project\v3.0\home\script.js'
```

结果：通过，无语法错误。

尝试使用内置浏览器做点击验证时，被本地沙盒拦截，未完成实际浏览器自动点击测试。

## 给下一个窗口的上下文

用户接下来想做“科目打开的页面”。当前页面路径是：

```text
D:\First\Personal-Portal-Project\v3.0\home\index.html
```

主页左侧菜单当前已有几个入口：

- 主页
- 笔记整理
- 网站收藏
- 计划日记
- 栖息地
- 添加小组件
- 设置

如果要做“科目打开的页面”，建议先确认用户说的“科目”对应哪个入口或模块：

- 可能是“笔记整理”下的科目页。
- 也可能是某个计划/学习模块里的科目详情页。
- 当前 `home/index.html` 里“笔记整理”和“网站收藏”是按钮，没有跳转链接。
- “计划日记”和“栖息地”已有跳转：
  - `../plan-journal/index.html`
  - `../Habitat/index.html`

继续开发时要注意：

- 如果新增页面也需要保存用户数据，应沿用这次修复后的思路：未登录、游客、邮箱账号数据必须分开。
- 游客数据可用 `user:guest:<key>`。
- 邮箱账号数据应使用 `user:${currentUser.id}:<key>`。
- 未登录状态不应写入会影响游客或账号的布局/内容数据。

## 当前修改的核心意图

这次修复不是简单清空数据，而是建立身份边界：

- 未登录：只看默认状态，不保存个人布局。
- 游客：独立本地身份。
- 邮箱账号：独立账号身份。

后续做新页面时，最好继续保持这个边界，避免不同身份之间再次串数据。
