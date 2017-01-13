import React, { Component } from 'react';
import './App.css';

/*
  0: ELEMENT      ->  < ELEMENT0
  1: ELEMENT0     ->  STRING ATTRIBUTES ELEMENT1
  2: ELEMENT1     ->  > ELEMENT_OR_DATA </ STRING >
  3: ELEMENT1     ->  />
  4: ELEM_OR_DATA ->  < ELEMENT0 ELEM_OR_DATA
  5: ELEM_OR_DATA ->  STRING ELEM_OR_DATA
  -1: ELEM_OR_DATA ->  epsilon
  6: ATTRIBUTES   ->  STRING = STRING ATTRIBUTES
  -2: ATTRIBUTES   ->  epsilon
*/

/*
const Symbols = {
  'Invalid': -1,
  // TERMINATE
  'TL': 0, // <
  'TR': 1, // >
  'TLS': 2, // </
  'TRS': 3,  // />
  'TNAME': 4, // <{STRING}>
  'TEQ': 5, // =
  'TEOF': 6,

  // NON-TERMINATE
  'ELEM': 9,
  'ELEM0': 10,
  'ELEM1': 11,
  'ELEM_DATA': 12,
  'ATTR': 13,
}
*/
const Symbols = {
  'Invalid': -1,
  // TERMINATE
  'TL': '<', // <
  'TR': '>', // >
  'TLS': '</', // </
  'TRS': '/>',  // />
  'TNAME': 'string', // <{STRING}>
  'TEQ': '=', // =
  'TEOF': 'End of file',

  // NON-TERMINATE
  'ELEM': 'Element',
  'ELEM0': 'Element0',
  'ELEM1': 'Element1',
  'ELEM_DATA': 'Element or data',
  'ATTR': 'Attribute',
}
const Table = { };
function s(row, col, ops) {
  if (!Table[row]) {
    Table[row] = {};
  }
  Table[row][col] = ops;
}
for (const key of Object.keys(Symbols)) {
  Table[Symbols[key]] = {}; // invalid tables, avoid errors;
}
s(Symbols.ELEM, Symbols.TL, 0);
s(Symbols.ELEM0, Symbols.TNAME, 1);
s(Symbols.ELEM1, Symbols.TR, 2);
s(Symbols.ELEM1, Symbols.TRS, 3);


s(Symbols.ELEM_DATA, Symbols.TL, 4);
s(Symbols.ELEM_DATA, Symbols.TNAME, 5);
s(Symbols.ELEM_DATA, Symbols.TR, -1);
s(Symbols.ELEM_DATA, Symbols.TRS, -1);
s(Symbols.ELEM_DATA, Symbols.TLS, -1);


s(Symbols.ATTR, Symbols.TNAME, 6);
s(Symbols.ATTR, Symbols.TL, -2);
s(Symbols.ATTR, Symbols.TR, -2);
s(Symbols.ATTR, Symbols.TLS, -2);
s(Symbols.ATTR, Symbols.TRS, -2);


class App extends Component {
  state = {
    process: [

    ],
    node: null,
    parsing: true,
  }

  onParseClick = () => {
    console.log(this.area.value);
    this.setState({
      parsing: false,
      process: [],
      node: null,
    });

    const process = [];
    const doc = this.area.value + '\0';

    const stack = [Symbols.TEOF, Symbols.ELEM];

    let pointer = 0;
    function lexer() {
      let a = doc[pointer++];
      while(a === ' ') {
        a = doc[pointer++];
      }
      if (a === '<') {
        if(doc[pointer] === '/') {
          pointer++; // move next
          return [Symbols.TLS, '</'];
        }
        return [Symbols.TL, a];
      } else if (a === '>') {
        return [Symbols.TR, a];
      } else if (a === '=') {
        return [Symbols.TEQ, a];
      } else if (a === '/' && doc[pointer] === '>') {
        pointer++;
        return [Symbols.TRS, '/>'];
      } else if (a === '\0') {
        return [Symbols.TEOF, a];
      }
      while(pointer <= doc.length) {
        const cur = doc[pointer];
        if (
          cur === '<'
          || cur === '>'
          || cur === '='
          || (cur === '/' && doc[pointer + 1] === '>')
          || cur === '\0'
          || cur === ' '
        ) {
          // pointer--;
          return [Symbols.TNAME, a];
        }
        a += cur;
        pointer++;
      }
      return [Symbols.Invalid, a];
    }

    let current = []; // keep track of current text
    let isEpsi = false;


    const nodeStack = []; // save current nodes

    let currentParent;

    let waitingAttr = 0;

    let firstNode;
    let lastKey;

    function addProcess(info) {
      process.push({
        info,
        text: current[1],
        progress: doc.substring(0, pointer),
        stack: `[ ${stack.join(' , ')} ]`,
      });
    }
    function equal(el) {
      stack.pop();
      if (el === Symbols.TLS) {
        nodeStack.pop(); // node end
      } else if (waitingAttr) { // will always get in if no exception
        const attrMap = nodeStack[nodeStack.length - 1].attributes;
        if (waitingAttr === 3) { // key
          attrMap[current[1]] = '';
          lastKey = current[1];
        } else if (waitingAttr === 1) {
          attrMap[lastKey] = current[1];
        }
        waitingAttr--;
      }
      addProcess('Same Symbol');
    }

    // start parse
    outer: while(stack.length) {
      const el = stack[stack.length - 1];

      if (el === current[0]) {
        equal(el);
        isEpsi = false;
      } else {
        if (isEpsi) {
          isEpsi = false;
        } else {
          current = lexer(); // go to next point
          if (el === current[0]) {
            equal();
            continue;
          }
        }
        let op = Table[el][current[0]];

        switch(op) {
          case -1:
            stack.pop();
            isEpsi = true;
            addProcess('ELEM_OR_DATA ->  epsilon');
            break;
          case -2:
            stack.pop();
            isEpsi = true;
            addProcess('ATTRIBUTES   ->  epsilon');
            break;
          case 0:
            stack.pop();
            stack.push(Symbols.ELEM0);
            stack.push(Symbols.TL);
            addProcess('ELEMENT      ->  < ELEMENT0');
            break;
          case 1: // start of new elment
            const newNode = {
              name: current[1],
              children: [],
              attributes: {},
            };
            if (currentParent) {
              currentParent.children.push(newNode);
            }
            nodeStack.push(newNode); // new elem
            if (!firstNode) {
              firstNode = newNode;
            }
            stack.pop();
            stack.push(Symbols.ELEM1);
            stack.push(Symbols.ATTR);
            stack.push(Symbols.TNAME);
            addProcess('ELEMENT0     ->  STRING ATTRIBUTES ELEMENT1');
            break;
          case 2:
            stack.pop();
            stack.push(Symbols.TR);
            stack.push(Symbols.TNAME);
            stack.push(Symbols.TLS);
            stack.push(Symbols.ELEM_DATA);
            stack.push(Symbols.TR);
            addProcess('ELEMENT1     ->  > ELEMENT_OR_DATA </ STRING >')
            break;
          case 3:
            nodeStack.pop(); // node end
            stack.pop();
            stack.push(Symbols.TRS);
            addProcess('ELEMENT1     ->  />');
            break;
          case 4:
            currentParent = nodeStack[nodeStack.length - 1];
            stack.pop();
            stack.push(Symbols.ELEM_DATA);
            stack.push(Symbols.ELEM0);
            stack.push(Symbols.TL);
            addProcess('ELEM_OR_DATA ->  < ELEMENT0 ELEM_OR_DATA');
            break;
          case 5:
            // get string data
            const elem = nodeStack[nodeStack.length - 1];
            elem.children.push(current[1]);
            stack.pop();
            stack.push(Symbols.ELEM_DATA);
            stack.push(Symbols.TNAME); // DATA
            addProcess('ELEM_OR_DATA ->  STRING ELEM_OR_DATA');
            break;
          case 6:
            waitingAttr = 3; // wait for attributes
            stack.pop();
            stack.push(Symbols.ATTR);
            stack.push(Symbols.TNAME);
            stack.push(Symbols.TEQ);
            stack.push(Symbols.TNAME); // string
            addProcess('ATTRIBUTES  ->  STRING = STRING ATTRIBUTES');
            break;
          default:
            console.log('WTF is going on');
            addProcess('Failed to parse');
            break outer;
        }
      }
    }

    this.setState({
      parsing: true,
      process,
      node: firstNode,
    });
    console.log('Nodes:', firstNode);
  }

  render() {
    const { process, parsing } = this.state;

    return (
      <div className="App">
        <div className="App-header">
          <h2>LL(1) XML Parser</h2>
        </div>
        <textarea
          ref={ref => this.area = ref}
          className="xmlInput"
          defaultValue="<abc a=b c=e><ddz g=zz/><ddc/><a>bb<e/></a></abc>"
        />
        <button disabled={!parsing} onClick={this.onParseClick} >Parse</button>
        <ul className="progress">
          { process.map( (process, i) => <li key={i}>
              <span>{i}:</span>
              {process.text}
              <p>{process.stack}</p>
              <p className="decriptor">{process.info}</p>
              <p className="decriptor">{process.progress}</p>

            </li>)
           }
        </ul>
      </div>

    );
  }
}

export default App;
