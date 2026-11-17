# NGDC 对话翻译

将本目录完整复制到 Dingent 实际使用的插件目录（例如
`D:\DingentData\plugins\ngdc-input-translation`），然后重启 Python 后端。
在「助手」中添加并启用「NGDC 对话翻译」，确保
`translate_to_english` 工具也处于启用状态，然后保存。

Dingent 在调用主模型之前直接执行翻译工具。工具只接收 `text`，向
NGDC 发送 `sourceLang=auto`、`targetLang=en_XX` 的请求，并返回译文。
开启后，当前问题和模型上下文中的历史用户提问会发送给 NGDC。
助手回复、系统提示词、工具参数及结果、图片、Markdown 代码和 URL 保持原样。
翻译不改变聊天历史，也不改变回复语言设置。翻译失败时会停止本次模型调用。
