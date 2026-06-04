import { prisma } from '../../database/prisma.js';

const QUALIFICATION_LABELS: Record<string, string> = {
    CERTIFICATE_I: 'Certificate I',
    CERTIFICATE_II: 'Certificate II',
    CERTIFICATE_III: 'Certificate III',
    CERTIFICATE_IV: 'Certificate IV',
    DIPLOMA: 'Diploma',
    ADVANCED_DIPLOMA: 'Advanced Diploma',
    ASSOCIATE_DEGREE: 'Associate Degree',
    BACHELORS_DEGREE: "Bachelor's Degree",
    GRADUATE_CERTIFICATE: 'Graduate Certificate',
    GRADUATE_DIPLOMA: 'Graduate Diploma',
    MASTERS_DEGREE: "Master's Degree",
    DOCTORAL_DEGREE: 'Doctoral Degree'
};
const QUALIFICATION_ORDER = Object.keys(QUALIFICATION_LABELS);

export type JobFilters = {
    keyword: string;
    location: string;
    workMode: string;
    jobType: string;
    skill: string;
    requiredExperience: string;
    salaryMin: string;
    salaryMax: string;
    educationLevel: string;
};

type CandidateForRecommendation = {
    id: string;
    profileSummary: string | null;
    workExperience: string | null;
    preferredWorkingMode: string | null;
    preferredLocation: string | null;
    preferredJobType: string | null;
    skills: Array<{ skill: { name: string } }>;
    educationRecords: Array<{ qualificationType: string; major: string | null; school: string }>;
    experienceRecords: Array<{ fromDate: Date | null; toDate: Date | null; isCurrent: boolean; duties: string | null; jobTitle: string; company: string }>;
};

function normalise(value: unknown): string {
    return String(value || '')
        .toLowerCase()
        .replace(/['’]/g, '')
        .replace(/[^a-z0-9+#./\s-]/g, ' ')
        .replace(/[-_/]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokens(value: unknown): string[] {
    return Array.from(new Set(normalise(value)
        .split(' ')
        .filter(token => token.length > 1)));
}

function levenshtein(a: string, b: string): number {
    if (a === b)
        return 0;

    if (!a.length)
        return b.length;

    if (!b.length)
        return a.length;

    const previous = Array.from({ length: b.length + 1 }, (_value, index) => index);
    const current = new Array(b.length + 1);

    for (let i = 1; i <= a.length; i += 1) {
        current[0] = i;

        for (let j = 1; j <= b.length; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            current[j] = Math.min(
                current[j - 1] + 1,
                previous[j] + 1,
                previous[j - 1] + cost
            );
        }

        for (let j = 0; j <= b.length; j += 1)
            previous[j] = current[j];
    }

    return previous[b.length];
}

function fuzzyMatchesTerm(term: string, haystackTokens: string[], haystackText: string): boolean {
    const cleanTerm = normalise(term);

    if (!cleanTerm)
        return true;

    if (haystackText.includes(cleanTerm))
        return true;

    return haystackTokens.some(token => {
        if (token.includes(cleanTerm) || cleanTerm.includes(token))
            return true;

        const maxDistance = cleanTerm.length <= 5 ? 1 : 2;
        return Math.abs(token.length - cleanTerm.length) <= maxDistance
            && levenshtein(cleanTerm, token) <= maxDistance;
    });
}

function fuzzyAnyTermMatches(query: string, haystackText: string): boolean {
    const queryTerms = tokens(query);
    const haystackTokens = tokens(haystackText);

    return !queryTerms.length || queryTerms.some(term =>
        fuzzyMatchesTerm(term, haystackTokens, normalise(haystackText)));
}

function fuzzyAllTermMatches(query: string, haystackText: string): boolean {
    const queryTerms = tokens(query);
    const haystackTokens = tokens(haystackText);

    return !queryTerms.length || queryTerms.every(term =>
        fuzzyMatchesTerm(term, haystackTokens, normalise(haystackText)));
}

function qualificationRank(value: string | null | undefined): number {
    return QUALIFICATION_ORDER.indexOf(String(value || ''));
}

function qualificationLabel(value: string): string {
    return QUALIFICATION_LABELS[value] || value.replace(/_/g, ' ');
}

function parseNumber(value: string): number | null {
    if (!value)
        return null;

    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
}

function dateLabel(value: Date | null): string {
    if (!value)
        return '';

    return new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    }).format(value);
}

function parseExperienceDate(value: Date | null): Date | null {
    return value && !Number.isNaN(value.getTime()) ? value : null;
}

function calculateYearsOfExperience(experience: CandidateForRecommendation['experienceRecords']): number {
    const ranges = experience.map(item => {
        const from = parseExperienceDate(item.fromDate);
        const to = item.isCurrent ? new Date() : parseExperienceDate(item.toDate);

        if (!from || !to || to <= from)
            return null;

        return [from.getTime(), to.getTime()];
    }).filter(Boolean).sort((a: any, b: any) => a[0] - b[0]) as number[][];
    const merged: number[][] = [];

    ranges.forEach(range => {
        const last = merged[merged.length - 1];

        if (!last || range[0] > last[1]) {
            merged.push([...range]);
            return;
        }

        last[1] = Math.max(last[1], range[1]);
    });

    const totalMs = merged.reduce((total, range) => total + (range[1] - range[0]), 0);
    return Math.round((totalMs / (1000 * 60 * 60 * 24 * 365.25)) * 10) / 10;
}

function searchableJobText(job: any): string {
    return [
        job.jobTitle,
        job.jobDescription,
        job.companyInformation,
        job.jobLocation,
        job.company?.name,
        job.company?.industry,
        ...job.skills.map((item: any) => item.skill.name)
    ].filter(Boolean).join(' ');
}

export function formatJob(job: any) {
    return {
        id: job.id,
        jobTitle: job.jobTitle,
        companyName: job.company?.name || '',
        companyIndustry: job.company?.industry || '',
        companyInformation: job.companyInformation || '',
        jobDescription: job.jobDescription || '',
        jobDescriptionPreview: String(job.jobDescription || '').slice(0, 220),
        jobLocation: job.jobLocation,
        workMode: job.workMode,
        jobType: job.jobType || '',
        requiredExperience: job.requiredExperience,
        requiredEducationLevel: job.requiredEducationLevel,
        requiredEducationLabel: qualificationLabel(job.requiredEducationLevel),
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryRange: job.salaryMin || job.salaryMax
            ? [job.salaryMin ? `$${job.salaryMin.toLocaleString('en-AU')}` : '', job.salaryMax ? `$${job.salaryMax.toLocaleString('en-AU')}` : ''].filter(Boolean).join(' - ')
            : '',
        closingDate: job.closingDate ? job.closingDate.toISOString().slice(0, 10) : '',
        closingDateLabel: dateLabel(job.closingDate),
        skills: job.skills.map((item: any) => item.skill.name),
        searchableText: searchableJobText(job)
    };
}

export function normaliseFilters(query: Record<string, unknown>): JobFilters {
    const keyword = query.keyword || query.q || '';

    return {
        keyword: String(keyword).trim().slice(0, 180),
        location: String(query.location || '').trim().slice(0, 180),
        workMode: String(query.workMode || '').trim().slice(0, 30),
        jobType: String(query.jobType || '').trim().slice(0, 40),
        skill: String(query.skill || '').trim().slice(0, 100),
        requiredExperience: String(query.requiredExperience || '').trim().slice(0, 10),
        salaryMin: String(query.salaryMin || '').trim().slice(0, 12),
        salaryMax: String(query.salaryMax || '').trim().slice(0, 12),
        educationLevel: String(query.educationLevel || '').trim().slice(0, 80)
    };
}

export async function loadActiveJobs() {
    return prisma.jobPosting.findMany({
        where: {
            status: 'ACTIVE',
            isActive: true,
            OR: [
                {
                    closingDate: null
                },
                {
                    closingDate: {
                        gt: new Date()
                    }
                }
            ]
        },
        select: {
            id: true,
            jobTitle: true,
            companyInformation: true,
            jobDescription: true,
            requiredEducationLevel: true,
            requiredExperience: true,
            workMode: true,
            jobLocation: true,
            salaryMin: true,
            salaryMax: true,
            jobType: true,
            closingDate: true,
            company: {
                select: {
                    name: true,
                    industry: true
                }
            },
            skills: {
                select: {
                    skill: {
                        select: {
                            name: true
                        }
                    }
                },
                orderBy: {
                    skill: {
                        name: 'asc'
                    }
                }
            }
        },
        orderBy: {
            updatedAt: 'desc'
        }
    });
}

export function searchJobs(jobs: any[], filters: JobFilters) {
    const salaryMin = parseNumber(filters.salaryMin);
    const salaryMax = parseNumber(filters.salaryMax);
    const requiredExperience = parseNumber(filters.requiredExperience);
    const requiredEducationRank = qualificationRank(filters.educationLevel);

    return jobs.map(formatJob).filter(job => {
        const keywordMatch = !filters.keyword || fuzzyAnyTermMatches(filters.keyword, job.searchableText);
        const locationMatch = !filters.location || fuzzyAllTermMatches(filters.location, job.jobLocation);
        const workModeMatch = !filters.workMode || job.workMode === filters.workMode;
        const jobTypeMatch = !filters.jobType || job.jobType === filters.jobType;
        const skillMatch = !filters.skill || fuzzyAllTermMatches(filters.skill, job.skills.join(' '));
        const experienceMatch = requiredExperience === null || job.requiredExperience <= requiredExperience;
        const educationMatch = requiredEducationRank < 0 || qualificationRank(job.requiredEducationLevel) <= requiredEducationRank;
        const salaryMinMatch = salaryMin === null || (job.salaryMax !== null && job.salaryMax >= salaryMin);
        const salaryMaxMatch = salaryMax === null || (job.salaryMin !== null && job.salaryMin <= salaryMax);

        return keywordMatch
            && locationMatch
            && workModeMatch
            && jobTypeMatch
            && skillMatch
            && experienceMatch
            && educationMatch
            && salaryMinMatch
            && salaryMaxMatch;
    });
}

function textOverlapScore(candidate: CandidateForRecommendation, job: any): boolean {
    const candidateText = [
        candidate.profileSummary,
        candidate.workExperience,
        ...candidate.educationRecords.map(item => `${item.major || ''} ${item.school}`),
        ...candidate.experienceRecords.map(item => `${item.jobTitle} ${item.company} ${item.duties || ''}`)
    ].join(' ');

    const jobText = `${job.jobTitle} ${job.jobDescription} ${job.companyInformation}`;
    const candidateTerms = tokens(candidateText).filter(term => term.length >= 4);
    const jobTextNormalised = normalise(jobText);

    return candidateTerms.some(term => jobTextNormalised.includes(term));
}

function scoreJob(candidate: CandidateForRecommendation, job: any) {
    const candidateSkills = candidate.skills.map(item => item.skill.name.toLowerCase());
    const jobSkills = job.skills.map((item: any) => item.skill.name.toLowerCase());
    const matchedSkills = jobSkills.filter((skill: string) => candidateSkills.includes(skill));
    const years = calculateYearsOfExperience(candidate.experienceRecords);
    let score = 0;
    const reasons: string[] = [];

    if (jobSkills.length) {
        score += Math.min(40, (matchedSkills.length / jobSkills.length) * 40);
        if (matchedSkills.length)
            reasons.push(...matchedSkills.slice(0, 3).map((skill: string) => skill.replace(/\b\w/g, character => character.toUpperCase())));
    }

    if (candidate.preferredWorkingMode === job.workMode) {
        score += 15;
        reasons.push(`${job.workMode.toLowerCase().replace('_', ' ')} work mode`);
    }

    if (candidate.preferredLocation && normalise(job.jobLocation).includes(normalise(candidate.preferredLocation))) {
        score += 15;
        reasons.push(`${candidate.preferredLocation} location`);
    }

    if (candidate.preferredJobType && candidate.preferredJobType === job.jobType) {
        score += 10;
        reasons.push(`${job.jobType.toLowerCase().replace('_', ' ')} preference`);
    }

    if (years >= job.requiredExperience) {
        score += 10;
        reasons.push(`${job.requiredExperience}+ years experience`);
    } else if (job.requiredExperience > 0) {
        score += Math.min(10, (years / job.requiredExperience) * 10);
    } else {
        score += 10;
    }

    if (textOverlapScore(candidate, job)) {
        score += 10;
        reasons.push('profile keyword overlap');
    }

    return {
        ...formatJob(job),
        score: Math.round(Math.min(100, score)),
        explanation: reasons.length
            ? `Matched on ${reasons.join(', ')}.`
            : 'Limited profile overlap found.'
    };
}

export async function getRecommendedJobsForCandidate(candidateId: string, isMember: boolean) {
    const [candidate, jobs] = await Promise.all([
        prisma.candidate.findUnique({
            where: {
                id: candidateId
            },
            select: {
                id: true,
                profileSummary: true,
                workExperience: true,
                preferredWorkingMode: true,
                preferredLocation: true,
                preferredJobType: true,
                skills: {
                    select: {
                        skill: {
                            select: {
                                name: true
                            }
                        }
                    }
                },
                educationRecords: {
                    select: {
                        qualificationType: true,
                        major: true,
                        school: true
                    }
                },
                experienceRecords: {
                    select: {
                        fromDate: true,
                        toDate: true,
                        isCurrent: true,
                        duties: true,
                        jobTitle: true,
                        company: true
                    }
                }
            }
        }),
        loadActiveJobs()
    ]);

    if (!candidate)
        return [];

    const recommendations = jobs
        .map((job: any) => scoreJob(candidate as CandidateForRecommendation, job))
        .filter((job: { score: number }) => job.score > 0)
        .sort((a: { score: number }, b: { score: number }) => b.score - a.score);

    return isMember ? recommendations : recommendations.slice(0, 10);
}
