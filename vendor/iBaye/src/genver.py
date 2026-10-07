#!/usr/bin/env python3
import os
import time

epoch = os.environ.get('SOURCE_DATE_EPOCH')
stamp = time.gmtime(int(epoch)) if epoch is not None else time.localtime()
print('#define BAYE_VERSION "%s"' % time.strftime("%y%m%d %H:%M", stamp))
