# Benchmark Summary

## RSA Signature

| Dataset | Average (ms) | Median (ms) | Minimum (ms) | Maximum (ms) |
|---:|---:|---:|---:|---:|
| 128 bytes | 0.861 | 0.859 | 0.843 | 0.903 |
| 256 bytes | 0.852 | 0.851 | 0.842 | 0.876 |
| 512 bytes | 0.852 | 0.851 | 0.839 | 0.882 |
| 1024 bytes | 0.879 | 0.88 | 0.85 | 0.903 |


## Merkle Tree

| Dataset | Average (ms) | Median (ms) | Minimum (ms) | Maximum (ms) |
|---:|---:|---:|---:|---:|
| 10 tx | 0.165 | 0.138 | 0.1 | 0.599 |
| 50 tx | 0.509 | 0.49 | 0.471 | 0.667 |
| 100 tx | 1.09 | 1.004 | 0.939 | 2.208 |
| 250 tx | 2.394 | 2.377 | 2.297 | 2.668 |
| 500 tx | 4.957 | 4.774 | 4.6 | 8.113 |
| 1000 tx | 9.684 | 9.591 | 9.254 | 13.388 |


## Block Creation

| Dataset | Average (ms) | Median (ms) | Minimum (ms) | Maximum (ms) |
|---:|---:|---:|---:|---:|
| 10 tx | 0.103 | 0.102 | 0.1 | 0.129 |
| 50 tx | 0.501 | 0.486 | 0.466 | 0.656 |
| 100 tx | 0.997 | 0.96 | 0.925 | 1.287 |
| 250 tx | 2.542 | 2.463 | 2.323 | 3.107 |
| 500 tx | 4.969 | 4.902 | 4.638 | 5.849 |
| 1000 tx | 10.083 | 10.027 | 9.558 | 11.255 |


## Blockchain Verification

| Dataset | Average (ms) | Median (ms) | Minimum (ms) | Maximum (ms) |
|---:|---:|---:|---:|---:|
| 10 blocks | 0.49 | 0.473 | 0.438 | 0.642 |
| 50 blocks | 2.624 | 2.458 | 2.325 | 7.177 |
| 100 blocks | 4.75 | 4.72 | 4.618 | 5.535 |
| 250 blocks | 11.879 | 11.781 | 11.501 | 13.448 |
| 500 blocks | 23.334 | 23.187 | 22.735 | 27.012 |
| 1000 blocks | 47.208 | 46.562 | 45.542 | 79.09 |


## Dominant Component

The component with the largest median execution time in these experiments is **Blockchain Verification** (dataset: 1000 blocks) with median = 46.562 ms and average = 47.208 ms.