#!/usr/bin/env python3
import os
import sys
import time

epoch = os.environ.get('SOURCE_DATE_EPOCH')
stamp = time.gmtime(int(epoch)) if epoch is not None else time.localtime()
header = '#define BAYE_VERSION "%s"\n' % time.strftime("%y%m%d %H:%M", stamp)
if len(sys.argv) > 1:
    with open(sys.argv[1], 'w', encoding='utf-8', newline='\n') as output:
        output.write(header)
else:
    print(header, end='')
