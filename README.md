# X++

X++ is a compiled programming language developed by [@creeperdoesredstone](https://github.com/creeperdoesredstone) for the conceptual VM **Xenon-124**.

---

# Language features

<details>
<summary>Basic syntax</summary>

X++ uses double slashes (`//`) for single-line comments:

```js
// This is a comment

```

Semicolons must not terminate statements in X++:

```kotlin
var x: int = 5  ✅
var y: int = 3; ❌ // The compiler will freak out if this happens

```

</details>

<details>
<summary>Expression parsing</summary>

X++ follows the standard order of operations:

| Operator | Precedence | Associativity |
| --- | --- | --- |
| `call`, `access` | 1 (highest) | left |
| `**` | 2 | right |
| `*`, `/`, `%` | 3 | left |
| `+`, `-` | 4 | left |
| `<`, `>`, `==`, `!=`, `<=`, `>=` | 5 | left |
| `assignment` | 6 (lowest) | none |

</details>

<details>
<summary>Data types</summary>

Currently, X++ supports the following data types:

* `int` (`-32768` to `32767`)
* `float` (`-65504` to `65504`)

</details>

<details>
<summary>Variables</summary>

X++ variables are declared using the following syntax:

```nim
var name: type = (expression)

```

Once declared, variables can be reassigned to different values through the assignment operator:

```js
x = (expression)

```

When compiled, this results in:

```asm
; assume the result of the expression is in AX
LDIR BX, $name
STRE @BX, AX

```

Compound assignment operators (`+=`, `-=`, `*=`, ...) are also supported.
In this case, the compiler would return:

```asm
; assume the result of the expression is in AX
LDIR BX, $name
LOAD DX, @BX
ADD DX, AX, AX ; or SUB/MUL/DIV/MOD/POW
STRE @BX, AX

```

A variable's value can also be incremented or decremented using the postfix `++` or `--` operators, respectively:

```js
x++
x--

```

In this case, the compiler would return:

```asm
; assume the result of the expression is in AX
LDIR BX, $name
LOAD AX, BX
INCR AX ; or DECR if using `--`
STRE @BX, AX

```

</details>

<details>
<summary>For Loops</summary>

For loops are used when you know exactly how many times you want to iterate a block of code.
They have the following syntax:

```js
for (statement 1; statement 2; statement 3) { // note the use of semicolons
  // body
}

```

* **Statement 1** is executed once before the execution of the code block.
* **Statement 2** is the condition for executing the code block.
* **Statement 3** is executed every time after the code block has been executed.

For example, this for loop

```nim
for (var i: int = 0; i < 5; i++) {}

```

would result in the following assembly (comments are added for ease of reading):

```asm
LDIR AX, #0000
LDIR BX, $i
STRE @BX, AX ; var i: int = 0
F0: ; begin loop
LDIR BX, $i
LOAD AX, @BX
PUSH AX
LDIR AX, #0005
POP DX
COMP DX, AX
JUMP GE, .F1 ; if i >= 5, exit the loop
LOAD AX, @BX
INCR AX
STRE @BX, AX
JUMP AL, .F0 ; i++
F1: ; end loop
HALT

```

</details>
