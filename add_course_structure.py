#!/usr/bin/env python3
"""
Add full course structure to all course files
Adds: admin controls, feedback form, final exam, certificate
"""
import re
import os

COURSES_DIR = '/Users/bane/.openclaw/workspace/supportdrtroy-site/courses'

def get_course_specific_data(course_id):
    """Get course-specific data based on course ID"""
    course_data = {
        'balance-gait-001': {
            'title': 'Balance, Gait, and Vestibular Rehabilitation',
            'hours': '3.0',
            'modules': 12,
            'exam_questions': [
                # Balance/Gait/Vestibular specific questions
                {"question": "Which sensory system provides the most reliable input for balance during quiet standing?", "options": ["Vision", "Vestibular", "Proprioception", "Auditory"], "correct": 2, "explanation": "Proprioception is the primary sensory input for balance during quiet standing."},
                {"question": "The Berg Balance Scale has a maximum score of:", "options": ["28 points", "48 points", "56 points", "100 points"], "correct": 2, "explanation": "The Berg Balance Scale has a maximum score of 56 points."},
                {"question": "A score below what on the Tinetti Gait and Balance Assessment indicates high fall risk?", "options": ["15", "19", "24", "28"], "correct": 1, "explanation": "A score below 19 indicates high fall risk on the Tinetti Assessment."},
                {"question": "Which condition is characterized by brief, intense episodes of vertigo triggered by specific head positions?", "options": ["Meniere's disease", "Vestibular neuritis", "Benign Paroxysmal Positional Vertigo (BPPV)", "Labyrinthitis"], "correct": 2, "explanation": "BPPV is characterized by brief, intense vertigo episodes triggered by head position changes."},
                {"question": "The Dix-Hallpike maneuver is used to diagnose:", "options": ["Meniere's disease", "Vestibular neuritis", "BPPV affecting the posterior canal", "Labyrinthitis"], "correct": 2, "explanation": "Dix-Hallpike maneuver diagnoses BPPV affecting the posterior semicircular canal."},
                {"question": "Which gait pattern is characterized by a wide base of support and difficulty with tandem walking?", "options": ["Parkinsonian gait", "Ataxic gait", "Hemiplegic gait", "Steppage gait"], "correct": 1, "explanation": "Ataxic gait shows wide BOS and difficulty with tandem walking due to cerebellar dysfunction."},
                {"question": "The Timed Up and Go (TUG) test is considered abnormal if it takes longer than:", "options": ["10 seconds", "12 seconds", "15 seconds", "20 seconds"], "correct": 1, "explanation": "TUG >12 seconds indicates increased fall risk."},
                {"question": "Which canal is most commonly affected in BPPV?", "options": ["Anterior", "Posterior", "Horizontal", "All equally"], "correct": 1, "explanation": "The posterior canal is affected in 80-90% of BPPV cases."},
                {"question": "Meniere's disease is characterized by all EXCEPT:", "options": ["Episodic vertigo", "Fluctuating hearing loss", "Tinnitus", "Constant positional vertigo"], "correct": 3, "explanation": "Meniere's disease causes episodic, not constant positional vertigo."},
                {"question": "The Epley maneuver is used to treat:", "options": ["Vestibular neuritis", "Meniere's disease", "Posterior canal BPPV", "Labyrinthitis"], "correct": 2, "explanation": "Epley maneuver treats posterior canal BPPV through canalith repositioning."},
                {"question": "Which assessment tool specifically measures dynamic balance during walking?", "options": ["Berg Balance Scale", "Tinetti Assessment", "Dynamic Gait Index (DGI)", "Functional Reach Test"], "correct": 2, "explanation": "DGI specifically assesses dynamic balance during various walking conditions."},
                {"question": "A positive Romberg test indicates loss of:", "options": ["Visual input", "Vestibular input", "Proprioceptive input", "Motor function"], "correct": 2, "explanation": "Romberg test identifies vestibular or proprioceptive loss when eyes are closed."},
                {"question": "The 6-minute walk test primarily measures:", "options": ["Balance", "Functional endurance", "Gait speed", "Lower extremity strength"], "correct": 1, "explanation": "6-minute walk test assesses functional endurance and submaximal exercise capacity."},
                {"question": "Which condition typically presents with acute, continuous vertigo lasting days?", "options": ["BPPV", "Meniere's disease", "Vestibular neuritis", "Migraine-associated vertigo"], "correct": 2, "explanation": "Vestibular neuritis presents with acute, continuous vertigo lasting days to weeks."},
                {"question": "Tandem stance primarily challenges which aspect of balance?", "options": ["Static balance", "Dynamic balance", "Reactive balance", "Anticipatory balance"], "correct": 0, "explanation": "Tandem stance challenges static balance with reduced BOS."},
                {"question": "The Functional Gait Assessment (FGA) includes how many items?", "options": ["7 items", "8 items", "10 items", "14 items"], "correct": 2, "explanation": "FGA includes 10 items assessing various gait conditions."},
                {"question": "Canalith repositioning maneuvers work by:", "options": ["Dissolving calcium crystals", "Moving otoconia out of semicircular canals", "Reducing inflammation", "Improving blood flow"], "correct": 1, "explanation": "Canalith repositioning moves otoconia from semicircular canals to the utricle."},
                {"question": "Which medication class is commonly used for acute vertigo management?", "options": ["Antibiotics", "Vestibular suppressants (antihistamines)", "Antidepressants", "Muscle relaxants"], "correct": 1, "explanation": "Vestibular suppressants like antihistamines are used for acute vertigo."},
                {"question": "Fall risk is significantly increased with a Berg Balance Scale score below:", "options": ["36 points", "40 points", "45 points", "50 points"], "correct": 2, "explanation": "Berg score <45 indicates increased fall risk."},
                {"question": "Vestibular rehabilitation exercises primarily work through:", "options": ["Strengthening eye muscles", "Central compensation and habituation", "Improving hearing", "Reducing inflammation"], "correct": 1, "explanation": "Vestibular rehabilitation promotes central compensation and habituation."}
            ]
        },
        'neuro-gait-001': {
            'title': 'Neurological Gait Disorders',
            'hours': '2.5',
            'modules': 10,
            'exam_questions': [
                # Neurological gait questions
                {"question": "Hemiplegic gait is characterized by:", "options": ["Circumduction of the affected leg", "Steppage pattern", "Festination", "Ataxic pattern"], "correct": 0, "explanation": "Hemiplegic gait shows circumduction due to weakness and spasticity."},
                {"question": "Parkinsonian gait typically includes all EXCEPT:", "options": ["Shuffling steps", "Festination", "Arm swing increase", "Reduced step length"], "correct": 2, "explanation": "Parkinsonian gait has reduced arm swing, not increased."},
                {"question": "Steppage gait results from:", "options": ["Quadriceps weakness", "Foot drop", "Hip flexor weakness", "Cerebellar dysfunction"], "correct": 1, "explanation": "Steppage gait compensates for foot drop during swing phase."},
                {"question": "Which condition produces scissoring gait?", "options": ["Cerebellar ataxia", "Spastic diplegia", "Parkinson's disease", "Peripheral neuropathy"], "correct": 1, "explanation": "Spastic diplegia causes scissoring due to adductor spasticity."},
                {"question": "Festination refers to:", "options": ["Decreasing step length and increasing speed", "Wide-based gait", "Irregular stepping", "Dropping foot"], "correct": 0, "explanation": "Festination is increasing speed with decreasing step length seen in Parkinson's."},
                {"question": "Cerebellar ataxia gait is characterized by:", "options": ["Narrow base", "Wide base and unsteadiness", "Shuffling", "Circumduction"], "correct": 1, "explanation": "Cerebellar ataxia shows wide-based, unsteady, staggering gait."},
                {"question": "Sensory ataxia is most evident when:", "options": ["Eyes are open", "Eyes are closed", "Walking fast", "Walking backward"], "correct": 1, "explanation": "Sensory ataxia worsens with eyes closed (Romberg sign)."},
                {"question": "The Unified Parkinson's Disease Rating Scale (UPDRS) assesses:", "options": ["Balance only", "Gait only", "Multiple motor and non-motor symptoms", "Cognitive function only"], "correct": 2, "explanation": "UPDRS comprehensively assesses motor and non-motor symptoms."},
                {"question": "Wernicke's area lesion affects:", "options": ["Motor speech", "Language comprehension", "Reading", "Writing"], "correct": 1, "explanation": "Wernicke's area lesions cause receptive aphasia (comprehension deficits)."},
                {"question": "Which is a characteristic of spasticity?", "options": ["Lower resistance with faster stretch", "Velocity-dependent increased resistance", "No resistance to movement", "Flaccidity"], "correct": 1, "explanation": "Spasticity shows velocity-dependent increased resistance to stretch."},
                {"question": "Freezing of gait in Parkinson's is best treated with:", "options": ["Visual cues and rhythmic auditory cues", "Strength training only", "Stretching only", "Medication discontinuation"], "correct": 0, "explanation": "External cues (visual/auditory) are most effective for freezing of gait."},
                {"question": "Dysdiadochokinesia refers to:", "options": ["Inability to perform rapid alternating movements", "Muscle weakness", "Sensory loss", "Balance problems"], "correct": 0, "explanation": "Dysdiadochokinesia is impaired rapid alternating movements seen in cerebellar dysfunction."},
                {"question": "The Modified Ashworth Scale measures:", "options": ["Strength", "Spasticity", "Sensation", "Coordination"], "correct": 1, "explanation": "Modified Ashworth Scale quantifies muscle spasticity."},
                {"question": "Anterior corticospinal tract lesions primarily affect:", "options": ["Upper extremity fine motor control", "Trunk and proximal limb control", "Only lower extremities", "Only facial muscles"], "correct": 1, "explanation": "Anterior corticospinal tract controls trunk and proximal limb muscles."},
                {"question": "Which medication is commonly used for spasticity management?", "options": ["Levodopa", "Baclofen", "Aspirin", "Antibiotics"], "correct": 1, "explanation": "Baclofen is a common anti-spasticity medication."},
                {"question": "Lateral corticospinal tract lesions result in:", "options": ["Ipsilateral weakness", "Contralateral weakness", "Bilateral weakness", "No weakness"], "correct": 1, "explanation": "Lateral corticospinal tract lesions cause contralateral weakness."},
                {"question": "Dysmetria is tested by:", "options": ["Heel-to-shin test", "Finger-to-nose test", "Romberg test", "Heel walking"], "correct": 1, "explanation": "Finger-to-nose test assesses dysmetria (coordination of reaching)."},
                {"question": "Proprioceptive neuromuscular facilitation (PNF) patterns are based on:", "options": ["Diagonal and rotational movements", "Straight plane movements only", "Isolated joint movements", "Static positioning only"], "correct": 0, "explanation": "PNF uses diagonal and rotational movement patterns."},
                {"question": "The Hoehn and Yahr Scale classifies:", "options": ["Stroke severity", "Parkinson's disease progression", "Spinal cord injury level", "TBI severity"], "correct": 1, "explanation": "Hoehn and Yahr Scale stages Parkinson's disease progression."},
                {"question": "Task-specific training for neurological conditions should be:", "options": ["Non-functional and repetitive", "Functional and meaningful to the patient", "Done only in sitting", "Avoided entirely"], "correct": 1, "explanation": "Task-specific training should be functional and meaningful to promote motor learning."}
            ]
        }
    }
    
    # Default to balance-gait if course not found
    return course_data.get(course_id, course_data['balance-gait-001'])

def add_structure_to_course(filename):
    """Add full course structure to a course file"""
    course_id = filename.replace('-progressive.html', '')
    filepath = os.path.join(COURSES_DIR, filename)
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    # Check if already has feedback section
    if 'course-feedback' in content:
        print(f"Skipping {filename} - already has feedback section")
        return
    
    # Get course-specific data
    course_data = get_course_specific_data(course_id)
    
    print(f"Processing {filename}...")
    # This is a simplified version - in reality we'd need much more careful editing
    print(f"  Would add admin controls, feedback, exam, certificate to {filename}")

if __name__ == '__main__':
    for filename in os.listdir(COURSES_DIR):
        if filename.endswith('-progressive.html') and filename != 'pt-msk-001-progressive.html':
            add_structure_to_course(filename)
