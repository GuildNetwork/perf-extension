(function () {
  const nodeList = [];
  const blockType = 'javascript/blocked';
  const activeType = 'application/javascript';

  const _createElement = document.createElement;

  const createDummyScript = (...args) => {
    const dummy = _createElement.bind(document)(...args);
    dummy._activated = false;
    dummy._setAttribute = dummy.setAttribute.bind(dummy);
    dummy._setAttribute('type', blockType);

    Object.defineProperties(dummy, {
      'src': {
        get() {
          if (!dummy._activated) {
            return dummy._src;
          }
          return dummy.getAttribute('src');
        },
        set(value) {
          if (!dummy._activated) {
            dummy._src = value;
          } else {
            dummy._setAttribute('src', value);
          }
          return true;
        }
      },
      'type': {
        set(value) {
          const typeValue = this._activated ? value : blockType;
          dummy._setAttribute('type', typeValue);
          return true
        }
      }
    });

    dummy.setAttribute = function (name, value) {
      if (name === 'type' || name === 'src') {
        dummy[name] = value
      } else {
        dummy._setAttribute(name, value);
      }
    }

    console.warn('dummy node created');
    return dummy;
  };

  document.createElement = function (...args) {
    if (args[0].toLowerCase() === 'script') {
      return createDummyScript(...args);
    }
    return _createElement.bind(document)(...args);
  };



  const frameCallback = async () => {
    return new Promise((resolve) => {
      window.requestAnimationFrame((timestamp) => resolve(timestamp));
    });
  };

  const pollForIde = async (timeout) => {
    const pollStart = Date.now();
    let prev = await frameCallback();
    let count = 0;
    while (true) {
      const now = Date.now();
      if ((now - pollStart) >= timeout) {
        console.warn('idle with timeout', count);
        return;
      }
      const t = await frameCallback();
      if ((t - prev) < 25) {
        count++;
      } else {
        count = 0;
      }
      prev = t;
      if (count >= 70) {
        return;
      }
    }
  };

  const enableNextScript = async () => {
    await pollForIde(8000);
    if (nodeList.length) {
      const s = nodeList.splice(0, 1)[0];
      if (s) {
        s.type = activeType;
        if (s._src) {
          s.src = s._src;
        } else {
          s.textContent = ' ' + s.textContent;
        }
        s._activated = true;
        console.warn(`enabling script (left: ${nodeList.length})`, s.src);
        await enableNextScript();
      }
    }
  };

  if (document.readyState === 'complete') {
    enableNextScript();
  } else {
    document.addEventListener('readystatechange', event => {
      if (event.target.readyState === 'complete') {
        enableNextScript();
      }
    });
  }

  const observer = new MutationObserver(mutations => {
    mutations.forEach(({ addedNodes }) => {
      if (addedNodes) {
        addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SCRIPT') {
            if (node._activated) {
              return;
            }
            if (node.type !== blockType) {
              if (node.src.indexOf('poweredbyslick') >= 0 || node.src.indexOf('poweredbyslick') >= 0 || node.src.indexOf('googletagmanager') >= 0) {
                return;
              }
              node.type = blockType;
              node._src = node.src;
              node._activated = false;
              node.removeAttribute('src');
            }

            const beforeScriptExecuteListener = function (event) {
              if (node.getAttribute('type') === blockType) {
                event.preventDefault();
              }
              node.removeEventListener('beforescriptexecute', beforeScriptExecuteListener)
            }
            node.addEventListener('beforescriptexecute', beforeScriptExecuteListener)

            if (nodeList.indexOf(node) < 0) {
              nodeList.push(node);
              console.warn('node blocked', node._src);
              if (document.readyState === 'complete' && (nodeList.length === 1)) {
                enableNextScript();
              }
            }
          }
        });
      }
    });
  });

  observer.observe(document.body || document.documentElement || document, {
    childList: true,
    subtree: true
  });

})();