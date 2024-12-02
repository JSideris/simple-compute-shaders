fn bitonic_compare_swap(i: u32, j: u32, dir: bool) {
    if ((data[i] > data[j]) == dir) {
        let temp = data[i];
        data[i] = data[j];
        data[j] = temp;
    }
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let id = global_id.x;

    // Perform bitonic sort using phases
    for (var k = 2u; k <= 2048; k *= 2) {
        for (var j = k / 2; j > 0; j /= 2) {
            let ixj = id ^ j;
            if (ixj > id) {
                bitonic_compare_swap(id, ixj, (id & k) == 0);
            }

            // Synchronize threads within a workgroup.
            workgroupBarrier();
        }
    }
}