# Architecture Update — React Three Fiber Dependencies — 2025-08-28

## Overview
Align @react-three/fiber and @react-three/drei versions with React 18.2.0 to resolve npm install dependency conflicts.

## Current AST Snapshot
package.json
- dependencies
  - @react-three/fiber: ^9.0.0 (peer React ^19)
  - @react-three/drei: ^10.5.1 (peer @react-three/fiber ^9)
  - react: 18.2.0
  - react-dom: 18.2.0

## Proposed AST
package.json
- dependencies
  - @react-three/fiber: ^8.18.0
  - @react-three/drei: ^9.122.0
  - react: 18.2.0
  - react-dom: 18.2.0

## Mermaid Diagram
```mermaid
graph TD
    React18[React 18.2.0]
    Fiber8[@react-three/fiber 8.18.0]
    Drei9[@react-three/drei 9.122.0]
    React18 --> Fiber8
    React18 --> Drei9
    Fiber8 --> Drei9
```

## Impact
- Restores compatibility with React 18
- Allows npm install to succeed without --legacy-peer-deps
