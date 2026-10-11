# R09 普通攻击前景生成记录

日期：2026-10-08。全部使用内置imagegen技能和 image_gen.imagegen，一组/一次尝试一个独立调用，失败和拒收均保留。

完整目标51个严格原字节唯一前景group（46 mask1透明＋5 mask0不透明）。背景16由根代理负责。标准库SHA256 3bd20146084054163d045c90987c756a6a210664e78253cc56bc4a274727903e。

当前进度：{"targetGroups":51,"finalGroups":51,"builtinCalls":63,"rejectedFinalCandidates":11,"failedCalls":1,"remainingGroups":0}。2026-10-09发布最后12组，全部51组原图齐备；区间接入与真实实战验收仍分别记录，不能将素材生成当作完整HD验收。

每次完整exact prompt、输入路径/角色/SHA/尺寸、原始输出路径/SHA/尺寸/mode/alpha和拒收/失败原因均见 [GENERATED-ATTACKS.json](GENERATED-ATTACKS.json)。接受PNG只按原byte复制，未裁切、resize、重编码、合成；低alpha软边缘保留。普通兵不套武将立绘身份。

原生原尺寸PNG从真实packed payload新解码；新增x16 packed-cell诊断参考也从同payload绘制，每bit对应16×16整格，仅供识别动作/武器，并非HD生产素材，未覆盖原114张。背景配色存在轻微纹理，不能称像素均匀。

## 当前group清单

|group|原生slots|尺寸/mask|状态|尝试数|最终PNG SHA|
|---:|---|---|---|---:|---|
|1|19/0/0|31×36/m1|generated-accepted|2|32b2155f29b94f5586ee87cd9039c2a59e034fea3a23acd06b4fdcf9445b7615|
|2|19/0/1|25×36/m1|generated-accepted|2|023b7636f58ab555ae1d94fbe3c0ac9c97c561e0daf4be16e82fb11df5dfb8a0|
|3|19/0/2|30×38/m1|generated-accepted|2|ab8e869318d99931d77bae27476fe207c99d4bec72f0d9fa00da8b4fb6dc365b|
|4|19/0/3|36×35/m1|generated-accepted|1|f5cc4bec0d3c923c2d1f68ccd367edfae198cb7917488a9d047ea74302f17e48|
|5|19/0/4|36×35/m1|generated-accepted|1|f65df0e86aeb63a3f15878b5c8a03bc32a9153c0afb6b66c9c090fe5a6789f51|
|6|19/0/5|34×41/m1|generated-accepted|1|7b69d48833d90b508004b139a96398cd67a04b779a1cc99c211219ec6e3fa1a9|
|7|19/0/6|36×35/m1|generated-accepted|1|b15bb8d7ad49946632f078b03ac0566502e2490e9a781c2a9028976cfe41e85e|
|8|19/0/7;20/0/4;21/0/4;22/0/6;23/0/7;24/0/6|31×36/m1|generated-accepted|1|8a2809734254544702482e8c41cafa39c2037480c060622691e3f1a8f60ab194|
|9|19/0/8;20/0/5;21/0/5;22/0/7;23/0/8;24/0/7|31×38/m1|generated-accepted|1|e35736689aadc87cf1c109fc2c5a471b986b3cf59ec9341289732f0107c07897|
|10|19/0/9;20/0/6;21/0/6;22/0/8;23/0/9;24/0/8|26×32/m1|generated-accepted|1|5905ddb8aa30ce15782089d67edd0cbb7ab26c3e91e3ba5b688a357e52af287e|
|11|19/0/10;20/0/7;21/0/7;22/0/9;23/0/10;24/0/9|29×28/m1|generated-accepted|2|7e5c5391f1200b9dd2f200defff123b8c133959b62cab6b5c04f4390e0f9c80d|
|12|19/0/11;20/0/9;21/0/9;22/0/11;23/0/12;24/0/11|23×29/m1|generated-accepted|1|8c51986e2c9eb5af110d027b9dba621dbb7a80761076af8b34c8b61c23ec2673|
|13|19/0/12;20/0/8;21/0/8;22/0/10;23/0/11;24/0/10|33×29/m1|generated-accepted|1|fcc89e8de7f603769aa6d24813a02571486915a0a12f1a7c6a64459c51ab5180|
|14|19/0/13;20/0/10;21/0/10;22/0/12;23/0/13;24/0/12|36×40/m1|generated-accepted|1|06313d1b07e679e6e6708559253dcc922c25f5360ef36354f80b71400823702d|
|15|19/0/14;20/0/11;21/0/11;22/0/13;23/0/14;24/0/13|38×43/m1|generated-accepted|1|d964ff4171c77715b6e1321a4df88a0e582489bf286af4466f626fc05f2b5c04|
|16|19/0/15;20/0/13;21/0/13;22/0/15;23/0/16;24/0/15|25×31/m1|generated-accepted|1|281500aeba297792e0199475bc5748c5ae0b23b1fdf786fafcc3941dde7f9a8a|
|17|19/0/16;20/0/12;21/0/12;22/0/14;23/0/15;24/0/14|29×35/m1|generated-accepted|1|f2c74e9bf8fab210f0101c8889fdf72799946abf5364dc08fdb7fb1c43f85a25|
|18|19/0/17;20/0/15;20/0/17;21/0/14;22/0/16;23/0/17;24/0/16|25×29/m1|generated-accepted|1|7df1251d2cedf1533abf428d651df99a7a269fd3ffd3d07af5a5579ae537a9ac|
|19|19/0/18;20/0/14;20/0/16;21/0/15;22/0/17;23/0/18;24/0/17|24×30/m1|generated-accepted|1|7bd87a3072b1a8b160a6dea22e9f379b231fe9c3ae4ca70fdcdfb6debe5d98f1|
|20|20/0/0|29×28/m1|generated-accepted|1|605e6b1873303e5ea3e2d20d28eb6707723804e7cf5047c5d40d137b382cd76d|
|21|20/0/1|25×28/m1|generated-accepted|1|8619e5bee9866e3d66d9f9fef73b894beaf1b6d8f76e457fed6497e9259d95ab|
|22|20/0/2|21×28/m1|generated-accepted|1|35ea52cfc289bb52612dfb9c36a062679b89d88e0fd413e2f864252c898bbd24|
|23|20/0/3|32×31/m1|generated-accepted|1|9199f6b79f620423e3b9eeaa04fee0dd1046d759ec0f723c87f723392cb98995|
|24|21/0/0|23×29/m1|generated-accepted|2|97d07bcbdf2152b55d2a3a6516a94d0ef9dfd680f3fa236e1ffe52bb33893874|
|25|21/0/1|28×31/m1|generated-accepted|1|6863c710283947ccd48451f8ba3d3f1bddeca7eb47ef22fe618630a4dbddf902|
|26|21/0/2|27×31/m1|generated-accepted|2|26ef49136edd06421e8072d85a9ac92ce6b9fa9234b9d609ae3969190c4fc7a3|
|27|21/0/3|28×29/m1|generated-accepted|2|709ea76a39e73b73decd7b6fadbf63c20c3c99727e791dc563a657c4faa2e3c4|
|28|21/0/16|10×5/m0|generated-accepted|1|90fa580dba38bec4027c283dd1758558bb26f81ed3dee1698019a025091aa860|
|29|21/0/17|9×5/m0|generated-accepted|1|9e7597d788f7223c3b70c1b9cc671d5ca8dd675bd3159217205442a024a2eb23|
|30|22/0/0|25×29/m1|generated-accepted|2|f9ff84420b028318bad01ff7a6b34fab614b0c8674b5ee3240b33e20303a555f|
|31|22/0/1|19×30/m1|generated-accepted|1|c622bfc3c09a50c0701bca8428bd49fc8c3808f3cb1cb3011f1eae3c3f6c2405|
|32|22/0/2|24×30/m1|generated-accepted|2|43ac13927ced4412d0c448b0c8fbb31474108df36086036f57f399e505a6cef2|
|33|22/0/3|26×30/m1|generated-accepted|1|be4bbe3c52adc12f427846e3f849cf611358579c45f9a2d7d25c14903e4e0143|
|34|22/0/4|21×28/m1|generated-accepted|1|18f9d1555cd91389b4871fd052cfa0688ce0d28604f9bd99180f1be751f97b64|
|35|22/0/5|32×29/m1|generated-accepted|1|bbaffff8fe1cbbeddc75119860a158a38c23a01bda46385e6b08d184e4658e5d|
|36|23/0/0|36×40/m1|generated-accepted|1|8f3fe7eb17025db797c809b95a30b7145ad61aa9e2e48378a51260f1258371d6|
|37|23/0/1|43×40/m1|generated-accepted|1|c94c6d0aefc46e66c00b9e27d74dd0b1b0d4bbd956f0f8dad0f8e0cc6b094ea2|
|38|23/0/2|41×40/m1|generated-accepted|2|a0f358e38d44d25c91b7f36927cac535515e7031ef45c1c46220ac4226465753|
|39|23/0/3|42×41/m1|generated-accepted|1|0bb499bdbf70a491e18905c293d55a588b6816e7ab1b773a5d57fb0106a3df2d|
|40|23/0/4|41×40/m1|generated-accepted|2|a18fbb75c819f4463a31dea70df1e7f9f386a5e1f44353ef4cf6e7810e8e8858|
|41|23/0/5|41×40/m1|generated-accepted|1|f026a84e0a046adb8e5e7912dcea80cced726fa62f7039aeeb7a0adbd36db83f|
|42|23/0/6|42×40/m1|generated-accepted|1|eefaa4c2d08c7f7d2c2650e06574c9682582a5443108bba0a1ef51bc83c19151|
|43|24/0/0|25×31/m1|generated-accepted|1|202b8cedb98f63ab8cad4f940fb91b1a8831ee31121562811682441e6d96c5be|
|44|24/0/1|27×31/m1|generated-accepted|2|4d7fd163c56a67f559efbf6bb60087d6c81a66d2abacb9a74d63e0f0d758aa5a|
|45|24/0/2|27×29/m1|generated-accepted|1|261b951b09959e1c25a99f082681fb37bb7f048b7b38fd4abe02c0708cdc402a|
|46|24/0/3|25×29/m1|generated-accepted|1|49c48358441d655a59e6a9c5a1e2fc93188adee34008b473864834e4e130618d|
|47|24/0/4|26×31/m1|generated-accepted|1|9f8c92a6cc1eb1a3e3d229ef7de56757c5d9774ee4989634f7c26cc2d8bdf0c8|
|48|24/0/5|30×28/m1|generated-accepted|1|48808d56e2eec76ea43755e8ac78a1385c0b90e6c0eaa90ad373651500210772|
|49|25/0/0|112×40/m0|generated-accepted|1|7752a8e85e07016a7ac607ea316ae7ef65b7cea589702a4486e1b277ca23f398|
|50|25/0/1|9×5/m0|generated-accepted|1|65ffa9613a86d121ecf239623624eacfecb002770d46f67371f043b890023630|
|51|25/0/2|10×5/m0|generated-accepted|1|5ed4814043d7af79be700a0a9699adc3b88698ba2c45515df2ebef7e9b8b27e1|

## 检查口径

实际逐张view生成原图，核对完整头冠/武器/双脚/马匹、原生朝向/姿态/人数、无文字/现代武器。alpha255以外也可能接近不透明：早期弓兵实际主体峰252–253约99%，不能仅以255计数描述成明显半透明。可见alpha>16 bbox与原图视觉联合用于边缘检查，极低alpha1软边不等同可见肢体裁切。

首bow裁弓梢候选与前三骑兵错误武器候选均保留拒收，不复制最终目标；角色style图容易污染器械，后续非弓兵采用原尺寸＋packed-cell诊断＋背景材料参考，未明器械不凭resource名字猜。实际SPE21/9..17子批优先，不代表其他36范围已真实运行。

静态素材预览与原生资源解码不等于实际native gameplay；完整累计clear/数字观察桥与真实攻击验收由根代理/其他代理另行执行。
