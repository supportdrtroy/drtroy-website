# MSK Clinical Decision Trees

## Shoulder Pain Decision Tree

```
Patient presents with shoulder pain
├── Red flags present? (fracture signs, infection, severe trauma)
│   └── YES → Immediate medical referral
│
├── NO → Continue systematic evaluation
    ├── Age >50 + night pain + weakness
    │   └── High suspicion rotator cuff tear
    │       ├── Positive lag signs → Likely full-thickness tear
    │       └── Negative lag signs → Consider partial tear
    │
    ├── Age <40 + overhead athlete + apprehension
    │   └── Consider instability
    │       ├── Positive apprehension test → Anterior instability likely
    │       └── Multidirectional symptoms → MDI workup
    │
    └── Gradual onset + overhead activities + impingement signs
        └── Subacromial impingement syndrome likely
            ├── Conservative trial appropriate
            └── Consider injection if no improvement
```

## Lumbar Spine Pain Decision Tree

```
Patient presents with low back pain
├── Red flags present? (cauda equina, fracture, infection)
│   └── YES → Immediate medical referral
│
├── NO → Continue evaluation
    ├── Leg pain > back pain + positive neurological signs
    │   └── Radiculopathy likely
    │       ├── Age <50 + acute onset → Consider disc herniation
    │       └── Age >50 + walking symptoms → Consider stenosis
    │
    ├── Back pain only + mechanical symptoms
    │   └── Consider mechanical LBP
    │       ├── <16 days + no distal symptoms → Manipulation candidate
    │       └── Recurrent episodes + instability → Stabilization approach
    │
    └── Unilateral buttock pain + positive SIJ tests
        └── SIJ dysfunction likely
```

## Knee Pain Decision Tree

```
Patient presents with knee pain
├── Acute trauma history?
│   └── YES → Consider fracture, ligament injury, meniscal tear
│       ├── Unable to bear weight → X-ray indicated (Ottawa Rules)
│       ├── Positive Lachman → ACL injury likely
│       └── Positive McMurray → Meniscal tear possible
│
├── NO → Gradual onset
    ├── Anterior knee pain + patellofemoral symptoms
    │   └── Consider PFPS
    │       ├── Positive patellar apprehension → Instability component
    │       └── Activity modification + strengthening indicated
    │
    └── Medial/lateral joint line pain
        └── Consider meniscal pathology or arthritis
            ├── Age >50 + gradual onset → Degenerative changes likely
            └── Younger + mechanical symptoms → Meniscal tear possible
```