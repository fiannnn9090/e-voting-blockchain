# Benchmark Summary

## RSA Signature

| Dataset | Average (ms) | Median (ms) | Minimum (ms) | Maximum (ms) |
|---:|---:|---:|---:|---:|
| 128 bytes | 0.869 | 0.863 | 0.849 | 0.922 |
| 256 bytes | 0.868 | 0.863 | 0.839 | 1.205 |
| 512 bytes | 0.853 | 0.852 | 0.842 | 0.873 |
| 1024 bytes | 0.871 | 0.869 | 0.843 | 0.959 |


## Merkle Tree

| Dataset | Average (ms) | Median (ms) | Minimum (ms) | Maximum (ms) |
|---:|---:|---:|---:|---:|
| 10 tx | 0.164 | 0.162 | 0.108 | 0.472 |
| 50 tx | 0.524 | 0.5 | 0.475 | 0.827 |
| 100 tx | 1.111 | 1.002 | 0.954 | 2.881 |
| 250 tx | 2.357 | 2.341 | 2.284 | 2.454 |
| 500 tx | 4.944 | 4.778 | 4.627 | 10.34 |
| 1000 tx | 9.649 | 9.538 | 9.249 | 13.471 |


## Block Creation

| Dataset | Average (ms) | Median (ms) | Minimum (ms) | Maximum (ms) |
|---:|---:|---:|---:|---:|
| 10 tx | 0.101 | 0.101 | 0.1 | 0.107 |
| 50 tx | 0.49 | 0.475 | 0.472 | 0.753 |
| 100 tx | 0.952 | 0.941 | 0.919 | 1.107 |
| 250 tx | 2.372 | 2.354 | 2.292 | 2.536 |
| 500 tx | 4.779 | 4.742 | 4.622 | 5.072 |
| 1000 tx | 9.823 | 9.726 | 9.536 | 13.817 |


## Blockchain Verification

| Dataset | Average (ms) | Median (ms) | Minimum (ms) | Maximum (ms) |
|---:|---:|---:|---:|---:|
| 10 blocks | 0.459 | 0.452 | 0.436 | 0.526 |
| 50 blocks | 2.387 | 2.365 | 2.346 | 2.812 |
| 100 blocks | 4.968 | 4.854 | 4.691 | 6.573 |
| 250 blocks | 11.902 | 11.938 | 11.406 | 12.659 |
| 500 blocks | 24.979 | 24.651 | 23.303 | 28.703 |
| 1000 blocks | 50.573 | 48.15 | 47.07 | 113.681 |


## Dominant Component

The component with the largest median execution time in these experiments is **Blockchain Verification** (dataset: 1000 blocks) with median = 48.15 ms and average = 50.573 ms.