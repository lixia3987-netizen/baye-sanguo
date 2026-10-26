# 原生图形消息与手机报告 HD（V92，轻量开发验证）

2026-10-26，补上原版PlcGraMsgBox的实际HD原文发布。原版三处调用分别用于获得经验、计谋失败、关闭动画后的技能名提示，过去均只画MSGBOX_PIC与经典文字；旧技能夹具将它替换成GamMsgBox，不能证明真实图形框已覆盖。本批在实际原文字绘制后set_report，原GamDelay前后begin／end，产品C精确只加三行，不改变原图片／文字／line几何或等待参数，也不写MP、经验或RNG。

复用现有kind1报告和双序号，不新增原生ABI。原版调用虽均为delay1，函数合同中的delay0仍保留：它等待首个非VM_TIMER消息，包含TOUCH_DOWN或ASCII；有限delay仍按原keyflag2，仅真实功能字符／TOUCH_UP提前结束，或timer1自然结束。delay255保留25500tick，不吞下一场景的键；timer0不减此计数。正常LIFO嵌套恢复原父文本／人物／kind时换双序号，不能据此泛化成已有通用report stack对任意reset后乱序旧退出也安全，本批未重构该协议。

同时修复手机战场原有报告退回LCD的缺口：报告独立使用kind:'report'的只读输入票，与原生HELP9／VIEW10分开，不依赖完整20单位数组。绑定原版LIB身份、实际data、报告全文／kind／person／seq／inputSeq、fight阶段／输入序号和detail generation；复用原detail=hd样式显示。确认／返回只按显式真实操作各发原39／40，同一native owner最多一次，spent跨blur保留；自然结束、换报告／库／data／模式或旧按压失效均不发键，不排队／补发方向或确认，不把定时报告改成必须确认。

最终9个相关模块由Node报告 **493／493**，失败／取消／跳过／todo均0，38源字节保持，实际Clang18。新增2个正式模块共19组（真实C10＋真实bridge／dialog／手机host9）；既有input脚本在Node计一个文件单元，其内部33个同步用例不另加到493。C模块直接编译真实PlcGraMsgBox、GamDelay、报告helpers和FgtShowGetExp，LCD／资源／消息入口为受控边界；既有技能／援助夹具只提供相关旧合同回归，不冒充完整实际技能链。

同一新C检查对父提交旧PublicFun源码 **0通过／10失败**，Node退出1，确认已编译且观测到真实C断言，未改产品源；包装命令退出0仅表示预期负控成立。早期C夹具错误要求父报告恢复同时重绘LCD的8／10失败、初版UI fixture的切片边界错误、独立review发现并修复的最后sender getter切经典模式漏键，均保留原记录。最终sender读取后重新检查实际mode／生命周期，再封口raw／source／refs；复跑原独立PoC已拒发、零键，正式测试含mode、host不可用及mode回调再改raw。

使用Emscripten3.1.51／CMake3.31.6重建并原子安装加载器／WASM／map／manifest，128原生源构建期间保持，除PublicFun外与V90原生记录相同。新聚合2251979174a889346026a1da4756d7772fa1a94115b2848e7629d46819c1b4d8，构建清单保留真实父提交fa2ccd2及modified=true。实际新加载器与链接WASM以noInitialRun在隔离Node VM初始化成功，83导出、三项必需入口存在，main未运行；四件安装字节逐一核对。baye.js与父提交原字节相同，仍参与成套核对而不强行制造Git差异。接口与存档格式保持，但不授完整ABI／真实存读档或历史RNG信用。

隔离Chrome profile加载生产m.html DOM、全部外部及内嵌CSS、真实bridge／dialog／mobile host和明确受控报告快照。最终实际CSS视口828×295，正文可见、detail=hd、舞台及两按钮完整位于可见区、按钮44px、无横溢出／页面错误、零键且raw不变；人工查看截图。初次预览漏了生产inline body margin样式而出现8px溢出，补齐真实样式后通过，未改产品来迎合夹具；两次浏览器尝试均保留，只有最后一次授布局信用。没有启动游戏、自动送确认或连接旧战局，不能称作真机或自然经验／施法接受。

完整9模块命令、38源SHA、旧C负控、128源／四产物、布局和审阅记录见[结构化记录](./m5-graphic-message-20261026-v92.json)，私有明细位于build/graphic-message-20261026-v92/。真实体验、真机与完整验证／调优后排；用户保留的旧战局不接入、关闭或重开。下一开发继续战前进攻／交锋公告及被动电脑策略预告，整体HD仍partial。
