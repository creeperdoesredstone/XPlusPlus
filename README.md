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

  Statements in X++ must not be terminated by semicolons:

  ```kotlin
  var x: int = 5  ✅
  var y: int = 3; ❌ // The compiler will freak out if this happens
  ```
</details>

<details>
  <summary>Expression parsing</summary>
  X++ follows the standard order of operations:
  
  | Operator | Precedence | Associativity |
  |---|---|---|
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

  A variable's value can also be incremented or decremented using the postfix `++` or `--` operators, respectively.
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
  <summary>Loops</summary>
  <details>
    <summary>For loops</summary>
  </details>
  <details>
    <summary>While loops</summary>
  </details>
</details>
