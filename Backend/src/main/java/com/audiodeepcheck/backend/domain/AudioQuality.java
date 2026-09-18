package com.audiodeepcheck.backend.domain;

import java.util.Collections;
import java.util.List;

/**
 * Signal health and quality metrics assessed for a call or audio chunk.
 */
public record AudioQuality(
        Double score,
        Boolean usable,
        Double snrDb,
        List<String> flags
) {
    public AudioQuality {
        if (flags == null) {
            flags = Collections.emptyList();
        }
    }

    public static AudioQuality pristine() {
        return new AudioQuality(1.0, true, 30.0, Collections.emptyList());
    }

    public static AudioQuality unusable(List<String> flags) {
        return new AudioQuality(0.0, false, 0.0, flags != null ? flags : Collections.emptyList());
    }
}
